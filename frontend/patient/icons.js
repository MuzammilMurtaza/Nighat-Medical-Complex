/* Local, dependency-free line icons. All visuals are decorative; controls retain text/ARIA labels. */
window.lucide = {
  createIcons() {
    const paths = {
      send: ['m22 2-7 20-4-9-9-4Z', 'm22 2-11 11'],
      paperclip: ['m21 11-8 8a5 5 0 0 1-7-7l9-9a3 3 0 0 1 4 4l-9 9a1 1 0 0 1-2-2l8-8'],
      languages: ['M4 5h12M10 3v2M6 5c0 5 4 9 8 11M14 5c0 5-4 9-10 11M14 21l4-10 4 10M15 18h6'],
      'chevron-right': ['m9 5 7 7-7 7'],
      'arrow-right': ['M4 12h16m-6-6 6 6-6 6'],
      phone: ['m6 3 3 5-2 2c2 4 4 6 8 8l2-2 5 3c-1 4-4 4-7 3C8 19 5 16 2 9 1 6 2 3 6 3Z'],
      'map-pin': ['M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z', 'M14 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0'],
      calendar: ['M4 5h16v16H4ZM8 2v6m8-6v6M4 10h16'],
      clock: ['M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0', 'M12 6v6l4 2'],
      lock: ['M5 10h14v11H5ZM8 10V6a4 4 0 0 1 8 0v4'],
      globe: ['M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0', 'M2 12h20M12 2c6 6 6 14 0 20-6-6-6-14 0-20'],
      'heart-handshake': ['M20 5c-3-3-7-1-8 1-2-3-6-4-9-1-5 6 9 16 9 16S26 11 20 5Z'],
      'check-circle-2': ['M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0', 'm7 12 3 3 7-7'],
      sparkles: ['m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z']
    };
    document.querySelectorAll('i[data-lucide]').forEach(el => {
      const name=el.dataset.lucide;
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('width','20');svg.setAttribute('height','20');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.7');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');svg.setAttribute('class','lucide lucide-'+name+(el.className?' '+el.className:''));
      if(el.getAttribute('style'))svg.setAttribute('style',el.getAttribute('style'));
      (paths[name] || (name.includes('calendar')?paths.calendar:name.includes('arrow')?paths['arrow-right']:paths.sparkles)).forEach(d=>{const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',d);svg.append(path)});
      el.replaceWith(svg);
    });
  }
};
