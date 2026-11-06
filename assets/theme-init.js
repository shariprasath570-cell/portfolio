/* Applied before first paint so the saved theme never flashes.
   Lives in its own file so the page needs no inline script, which lets the
   deployed site run a strict Content-Security-Policy. */

(function () {
    try {
        var saved = localStorage.getItem('hs-theme');
        document.documentElement.dataset.theme = saved || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    } catch (error) {
        document.documentElement.dataset.theme = 'dark';
    }
})();
