# Landing page do PDV-Lev: site estatico servido por nginx.
# Os arquivos ficam em /pdv-lev/ dentro do container, para o proxy da VPS
# repassar www.syncrofin.com.br/pdv-lev/... sem precisar cortar o prefixo.
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html estilos.css visor.js /usr/share/nginx/html/pdv-lev/
COPY fontes /usr/share/nginx/html/pdv-lev/fontes
COPY img /usr/share/nginx/html/pdv-lev/img

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/pdv-lev/ > /dev/null || exit 1
