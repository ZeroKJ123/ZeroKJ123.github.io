const MEME_CONFIG = {
    basePath: 'memes/',
    images: [
        '1.jpg',
        '2.jpg',
        '3.jpg',
        '4.jpg',
        '5.jpg',
        '6.jpg',
        '7.jpg',
        '8.jpg',
        '9.jpg',
        '10.jpg',
    ]
};

function getImagePath(filename) {
    return MEME_CONFIG.basePath + filename;
}

function getAllImagePaths() {
    return MEME_CONFIG.images.map(img => getImagePath(img));
}

function getShuffledImagePaths() {
    const paths = getAllImagePaths();
    for (let i = paths.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [paths[i], paths[j]] = [paths[j], paths[i]];
    }
    return paths;
}

function getImageCount() {
    return MEME_CONFIG.images.length;
}