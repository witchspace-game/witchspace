/** True when the page is on paper: light mode, or ?look=paper (the template decides, before anything is drawn). */
export const onPaper = () => document.documentElement.classList.contains('paper');
