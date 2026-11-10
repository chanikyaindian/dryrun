export const eh=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
export const PN=/^(i|j|k|l|r|p|q|m|lo|hi|low|high|mid|left|right|start|end|idx|index|pos|ptr|pivot|cur|curr|slow|fast|(min|max)_?(i|idx|index))\d*$/;
export const RM=matchMedia('(prefers-reduced-motion:reduce)').matches;
