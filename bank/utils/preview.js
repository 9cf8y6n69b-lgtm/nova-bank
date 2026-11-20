// معاينة حيّة لألوان/خلفية البطاقات (بدون حفظ)
const state = { current: null }; // { colors:{bgTop,bgBottom}, mode:'colors'|'image' }
let chain = Promise.resolve();
// يشغّل الرسم بإعدادات مؤقتة، ويرتّب الطلبات واحد ورا واحد
function withPreview(override, fn) {
  const run = chain.then(async () => {
    state.current = override;
    try { return await fn(); } finally { state.current = null; }
  });
  chain = run.catch(() => {});
  return run;
}
module.exports = { state, withPreview };
