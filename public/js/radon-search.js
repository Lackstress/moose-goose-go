// Radon Portal fallback search & load logic
(function(){
  const listEl = document.getElementById('gameList');
  const searchEl = document.getElementById('searchInput');
  const frame = document.getElementById('gameFrame');
  const emptyMsg = document.getElementById('emptyMsg');
  let games = [];

  async function fetchGames(){
    try {
      const res = await fetch('/radon-g3mes/api/games');
      const data = await res.json();
      games = data.games || [];
      renderList(games);
    } catch (err) {
      listEl.innerHTML = '<li style="opacity:.6;">Failed to load games.</li>';
    }
  }

  function renderList(items){
    listEl.innerHTML = '';
    if(!items.length){ emptyMsg.style.display='block'; return; } else emptyMsg.style.display='none';
    items.forEach(g => {
      const li = document.createElement('li');
      li.textContent = g.title + ' (' + g.id + ')';
      li.dataset.id = g.id;
      li.addEventListener('click', () => loadGame(g.id, li));
      listEl.appendChild(li);
    });
  }

  function loadGame(id, element){
    [...listEl.children].forEach(li => li.classList.remove('active'));
    element.classList.add('active');
    // Use existing server route /games/:id
    frame.src = '/games/' + id;
  }

  function handleSearch(){
    const q = searchEl.value.trim().toLowerCase();
    if(!q){ renderList(games); return; }
    const filtered = games.filter(g => g.title.toLowerCase().includes(q) || g.id.toLowerCase().includes(q));
    renderList(filtered);
  }

  searchEl.addEventListener('input', handleSearch);
  fetchGames();
})();
