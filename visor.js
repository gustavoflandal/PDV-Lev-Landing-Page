// Visualizador das telas: abre a imagem ampliada num <dialog>, com setas do
// teclado para navegar. Sem JavaScript, o link abre a imagem diretamente.
(function () {
  const links = Array.from(document.querySelectorAll('.vitrine, .tela a, .destaque a.quadro'));
  const visor = document.getElementById('visor');
  if (!visor || !links.length || typeof visor.showModal !== 'function') return;
  const img = visor.querySelector('img');
  const legenda = visor.querySelector('figcaption');
  let atual = 0;

  function mostrar(i) {
    atual = (i + links.length) % links.length;
    const a = links[atual];
    img.src = a.getAttribute('href');
    img.alt = a.querySelector('img')?.alt || '';
    legenda.textContent = a.dataset.legenda || img.alt;
  }

  links.forEach((a, i) => a.addEventListener('click', (e) => {
    e.preventDefault();
    mostrar(i);
    visor.showModal();
  }));
  visor.querySelector('.fechar').addEventListener('click', () => visor.close());
  visor.querySelector('.ant').addEventListener('click', () => mostrar(atual - 1));
  visor.querySelector('.prox').addEventListener('click', () => mostrar(atual + 1));
  visor.addEventListener('click', (e) => { if (e.target === visor) visor.close(); });
  visor.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') mostrar(atual - 1);
    if (e.key === 'ArrowRight') mostrar(atual + 1);
  });
  visor.addEventListener('close', () => { img.removeAttribute('src'); });
})();
