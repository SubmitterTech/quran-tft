const arabicLetters = 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي';
const colors = [
  '#FF5733', '#33FF57', '#3357FF', '#FF33A1', '#FF8333',
  '#33FF83', '#8333FF', '#FF3383', '#FF5733', '#33FF57',
  '#3357FF', '#FF33A1', '#FF8333', '#33FF83', '#8333FF',
  '#FF3383', '#FF5733', '#33FF57', '#3357FF', '#FF33A1',
  '#FF8333', '#33FF83', '#8333FF', '#FF3383', '#FF5733',
  '#33FF57', '#3357FF', '#FF33A1', '#FF8333'
];

const colorMap = {};
for (let i = 0; i < arabicLetters.length; i++) {
  colorMap[arabicLetters[i]] = colors[i];
}

export default colorMap;
