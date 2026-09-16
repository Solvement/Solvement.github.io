// Renders data/notes.json into the Notes section.
export function renderNotes(data) {
  const list = document.querySelector('#notes-index');
  const entries = data.entries.slice();
  const toggle = document.querySelector('#notes-toggle');
  let expanded = false;
  document.querySelectorAll('[data-account]').forEach(el => { el.textContent = data.account; });
  document.querySelectorAll('[data-copy]').forEach(el => el.setAttribute('data-copy', data.account));
  toggle.hidden = entries.length <= 3;
  toggle.addEventListener('click', () => { expanded = !expanded; draw(); });

  function draw() {
    const shown = expanded ? entries : entries.slice(0, 3);
    toggle.textContent = expanded ? 'Show fewer' : `View all ${entries.length} notes`;
    toggle.setAttribute('aria-expanded', String(expanded));
    list.replaceChildren(...shown.map((e, i) => {
      const li = document.createElement('li'); li.className = 'note-row';
      const no = document.createElement('span'); no.className = 'no'; no.textContent = String(i + 1).padStart(2, '0');
      const series = document.createElement('span'); series.className = 'series';
      series.textContent = data.series[e.series]?.label || e.series;
      const small = document.createElement('small'); small.textContent = e.date || (e.video ? 'video' : '—'); series.append(small);
      const body = document.createElement('div'); body.className = 'body';
      const h = document.createElement('h3'); h.lang = 'zh';
      if (e.url) { const a = document.createElement('a'); a.href = e.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = e.title; h.append(a); } else h.textContent = e.title;
      const sum = document.createElement('p'); sum.className = 'sum'; sum.textContent = e.summary;
      body.append(h, sum);
      const go = document.createElement('a'); go.className = 'go' + (e.url ? '' : ' pending');
      if (e.url) { go.href = e.url; go.target = '_blank'; go.rel = 'noopener'; go.textContent = 'Read on Xiaohongshu ↗'; }
      else { go.textContent = 'On Xiaohongshu'; go.setAttribute('aria-disabled', 'true'); }
      li.append(no, body); if (e.url) li.append(go); return li;
    }));
  }
  draw();
}
