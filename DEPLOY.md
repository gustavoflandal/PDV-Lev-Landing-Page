# Publicar a landing page em www.syncrofin.com.br/pdv-lev

A página roda num container próprio (`pdv-lev-landing`, nginx) ao lado do
syncrofin. Quem atende as portas 80/443 da VPS continua sendo o mesmo proxy de
hoje; você só acrescenta uma regra: **tudo que começar com `/pdv-lev` vai para o
container da landing page**, o resto continua indo para o syncrofin.

```
navegador ──► proxy da VPS (80/443, HTTPS) ──┬─ /pdv-lev/... ─► pdv-lev-landing
                                             └─ todo o resto ─► syncrofin
```

O container já serve os arquivos em `/pdv-lev/`, então o proxy **não deve cortar
o prefixo**: ele repassa o caminho como chegou.

Como o syncrofin já funciona em `www.syncrofin.com.br`, o DNS e o certificado
HTTPS já estão prontos — não há nada a fazer na Hostinger além do acesso SSH.

---

## 1. Descobrir qual proxy está na frente do syncrofin

Na VPS (SSH):

```bash
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Ports}}"
```

Procure o container que publica `0.0.0.0:80->` e `0.0.0.0:443->`. A imagem diz
qual é o seu caso:

| Imagem                                   | Seu caso |
|------------------------------------------|----------|
| `traefik`                                | **A**    |
| `jc21/nginx-proxy-manager`               | **B**    |
| `caddy`                                  | **C**    |
| `nginx`                                  | **D**    |
| nenhum container usa a 80/443            | proxy instalado direto no sistema: `sudo ss -ltnp \| grep -E ':(80\|443) '` mostra se é nginx ou caddy → caso **C** ou **D**, versão "no host" |

Se o proxy é um container (A, B, C ou D em container), anote também a **rede
Docker** dele:

```bash
docker inspect NOME_DO_CONTAINER_DO_PROXY --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}'
```

(Ex.: `syncrofin_default`, `proxy`, `traefik_network`.) Esse é o `NOME_DA_REDE`.

## 2. Baixar a landing page na VPS

```bash
cd /opt
sudo git clone https://github.com/gustavoflandal/PDV-Lev-Landing-Page.git pdv-lev-landing
cd /opt/pdv-lev-landing
```

## 3. Ligar o container na rede do proxy (só se o proxy for container)

Edite `docker-compose.yml` (`nano docker-compose.yml`):

1. descomente o bloco `networks:` do serviço e o bloco `networks:` do final;
2. troque `NOME_DA_REDE` pelo nome anotado no passo 1;
3. **só no caso A (Traefik)**: descomente também as `labels` (veja o caso A abaixo).

Proxy instalado direto no host: não mexa no arquivo; o proxy vai usar
`127.0.0.1:8090`.

## 4. Subir o container

```bash
docker compose up -d --build
curl -I http://127.0.0.1:8090/pdv-lev/
```

Deve responder `HTTP/1.1 200 OK`. Se a porta 8090 já estiver ocupada, troque o
número da esquerda em `ports:` (ex.: `127.0.0.1:8091:80`).

## 5. Acrescentar a regra no proxy

### Caso A — Traefik

Não há arquivo de proxy para editar: as `labels` do `docker-compose.yml` fazem
o trabalho. Copie do syncrofin os nomes do *entrypoint* e do *certresolver*:

```bash
docker inspect NOME_DO_CONTAINER_DO_SYNCROFIN --format '{{json .Config.Labels}}' | tr ',' '\n' | grep traefik
```

Procure algo como `...entrypoints=websecure` e `...tls.certresolver=letsencrypt`
e use os mesmos valores nas labels da landing page (troque `NOME_DO_RESOLVER` e,
se for diferente, `websecure`). Depois:

```bash
docker compose up -d
```

O Traefik dá prioridade à regra mais longa, então
`Host(www...) && PathPrefix(/pdv-lev)` ganha da regra do syncrofin sozinho.

### Caso B — Nginx Proxy Manager

No painel (normalmente `http://IP_DA_VPS:81`):

1. **Hosts → Proxy Hosts →** editar o host `www.syncrofin.com.br`;
2. aba **Custom locations → Add location**:
   - Location: `/pdv-lev`
   - Scheme: `http`
   - Forward Hostname / IP: `pdv-lev-landing` (sem barra, sem caminho)
   - Forward Port: `80`
3. **Save**.

### Caso C — Caddy

No `Caddyfile`, dentro do bloco do `www.syncrofin.com.br`, coloque a regra da
landing antes da do syncrofin, cada uma num `handle`:

```caddy
www.syncrofin.com.br {
	handle /pdv-lev* {
		reverse_proxy pdv-lev-landing:80
	}
	handle {
		# o que já existia para o syncrofin, ex.:
		reverse_proxy syncrofin:3000
	}
}
```

Caddy instalado no host: use `reverse_proxy 127.0.0.1:8090`. Use `handle`, não
`handle_path` (este cortaria o `/pdv-lev`). Recarregue:

```bash
docker exec NOME_DO_CONTAINER_DO_CADDY caddy reload --config /etc/caddy/Caddyfile
```

(no host: `sudo systemctl reload caddy`)

### Caso D — Nginx

No `server { ... }` que atende `www.syncrofin.com.br` (porta 443), acrescente:

```nginx
location /pdv-lev {
    proxy_pass http://pdv-lev-landing:80;   # nginx no host: http://127.0.0.1:8090;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Atenção: `proxy_pass` **sem** barra nem caminho no final, para o `/pdv-lev`
seguir junto. Teste e recarregue:

```bash
docker exec NOME_DO_CONTAINER_DO_NGINX nginx -t
docker exec NOME_DO_CONTAINER_DO_NGINX nginx -s reload
```

(no host: `sudo nginx -t && sudo systemctl reload nginx`)

## 6. Conferir

Abra **https://www.syncrofin.com.br/pdv-lev** — o endereço vira `/pdv-lev/`
(com barra) e a página aparece com estilo e imagens. Confira também que o
syncrofin continua normal em `https://www.syncrofin.com.br/`.

## Atualizar a página depois

Faça as mudanças, envie para o GitHub e, na VPS:

```bash
cd /opt/pdv-lev-landing
git pull
docker compose up -d --build
```

## Se algo der errado

| Sintoma | Causa provável |
|---------|----------------|
| Abre a tela do syncrofin (ou o 404 dele) | A regra do `/pdv-lev` não está valendo ou ficou depois da do syncrofin. Revise o passo 5 e recarregue o proxy. |
| `502 Bad Gateway` | O proxy não alcança o container: faltou o passo 3 (rede) ou o nome `pdv-lev-landing` está diferente. `docker network inspect NOME_DA_REDE` deve listar `pdv-lev-landing`. |
| Página sem estilo nem imagens | O proxy está cortando o `/pdv-lev` (caso C com `handle_path`, caso D com barra no `proxy_pass`). |
| `404 Not Found` simples do nginx | O caminho chegou sem `/pdv-lev` no container — mesma causa da linha acima. |

Logs do container: `docker logs --tail 50 pdv-lev-landing`.
