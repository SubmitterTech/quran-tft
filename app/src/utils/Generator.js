export const getRandom = () => {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return (array[0] % 6234) + 1;
};