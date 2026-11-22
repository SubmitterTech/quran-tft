#!/usr/bin/env node
/**
 * Publishes the large content files (Quran text, appendices, introduction, sura map)
 * as static assets under public/content, instead of letting webpack bundle them into
 * JavaScript chunks.
 *
 * Why: webpack turns a JSON import into JSON.parse('<ascii escaped string>'). The escaping
 * roughly doubles the bytes for non-Latin scripts, the chunks land in the service worker
 * precache, and the parsed objects stay in the webpack module cache for the lifetime of the
 * page. Serving the same data as plain JSON avoids all three.
 *
 * The files under src/assets stay the source of truth. The English base is part of this
 * repository; the translations and the language catalog are a submodule under
 * src/assets/translations that follows the release branch of its own repository.
 * Everything written here is generated output and stays out of version control.
 */

import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetsRoot = path.join(appRoot, 'src', 'assets');
const translationsRoot = path.join(assetsRoot, 'translations');
const outputRoot = path.join(appRoot, 'public', 'content');

// English is the base language; its files do not follow the <kind>_<lang>.json convention.
const BASE_SOURCES = {
    quran: 'qurantft.json',
    appendices: 'appendices.json',
    introduction: 'introduction.json',
    application: 'application.json',
    cover: 'cover.json',
};

// Kinds published per translated language. Application and cover are only a few kilobytes and
// stay in the bundle as well, but they are published too: a language added without an app
// release needs its interface strings and its cover page from here.
const TRANSLATION_KINDS = ['quran', 'appendices', 'introduction', 'map', 'application', 'cover'];

const readJson = (filePath) => {
    const raw = fs.readFileSync(filePath, 'utf8');
    try {
        return { data: JSON.parse(raw), bytes: Buffer.byteLength(raw) };
    } catch (error) {
        throw new Error(`Invalid JSON in ${path.relative(appRoot, filePath)}: ${error.message}`);
    }
};

const shortHash = (value) => crypto.createHash('sha256').update(value).digest('hex').slice(0, 12);

const writeContentFile = (name, serialized) => {
    // Minified, but still UTF-8: no \u escapes, so the bytes stay close to the text itself.
    const target = path.join(outputRoot, `${name}.json`);
    const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
    if (current !== serialized) {
        fs.writeFileSync(target, serialized);
    }
    return Buffer.byteLength(serialized);
};

// Which state of the translations this build carries. They follow their own release branch,
// so the app's commit does not say. Asked of the submodule itself: without the check a
// submodule that is not checked out would answer with this repository's commit.
const readTranslationsSource = () => {
    const git = (...args) => execFileSync('git', ['-C', translationsRoot, ...args], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    try {
        if (fs.realpathSync(git('rev-parse', '--show-toplevel')) !== fs.realpathSync(translationsRoot)) {
            return null;
        }
        const [commit, committedAt] = git('log', '-1', '--format=%H%n%cI').split('\n');
        return commit && committedAt ? { commit, committedAt } : null;
    } catch (error) {
        return null;
    }
};

const main = () => {
    fs.mkdirSync(outputRoot, { recursive: true });

    const published = new Set();
    const languages = {};
    let sourceBytes = 0;
    let publishedBytes = 0;

    const fileHashes = {};

    const publish = (kind, lang, sourcePath) => {
        const { data, bytes } = readJson(sourcePath);
        const name = kind === 'languages' ? 'languages' : `${kind}_${lang}`;
        const serialized = JSON.stringify(data);
        sourceBytes += bytes;
        publishedBytes += writeContentFile(name, serialized);
        published.add(`${name}.json`);
        if (kind !== 'languages') {
            languages[lang] = [...(languages[lang] || []), kind];
        }
        fileHashes[name] = shortHash(serialized);
    };

    Object.entries(BASE_SOURCES).forEach(([kind, fileName]) => {
        publish(kind, 'en', path.join(assetsRoot, fileName));
    });

    // The catalog travels with the content: a language added later needs its name, direction
    // and completeness figure to be offered at all.
    publish('languages', 'catalog', path.join(translationsRoot, 'languages.json'));

    const translatedLanguages = fs.existsSync(translationsRoot)
        ? fs.readdirSync(translationsRoot).filter((entry) => (
            fs.statSync(path.join(translationsRoot, entry)).isDirectory()
        )).sort()
        : [];

    translatedLanguages.forEach((lang) => {
        TRANSLATION_KINDS.forEach((kind) => {
            const sourcePath = path.join(translationsRoot, lang, `${kind}_${lang}.json`);
            if (fs.existsSync(sourcePath)) {
                publish(kind, lang, sourcePath);
            }
        });
    });

    // Inventory of what this build shipped. It is read only from the app's own package:
    // never from a mirror, and it is not an interface anyone else depends on. The revisions
    // let the runtime notice that a language's text changed, so the search and hyphenation
    // indexes built from that text can be rebuilt.
    const inventory = { revision: '', languages: {} };
    Object.keys(languages).sort().forEach((lang) => {
        const kinds = languages[lang].slice().sort();
        const revision = shortHash(kinds.map((kind) => fileHashes[`${kind}_${lang}`]).join(':'));
        inventory.languages[lang] = { revision, kinds };
    });
    inventory.revision = shortHash(
        Object.entries(inventory.languages).map(([lang, entry]) => `${lang}:${entry.revision}`).join('|')
    );

    // Not part of the revision: it says where the text came from, not what the text is.
    const translationsSource = readTranslationsSource();
    if (translationsSource) {
        inventory.source = { translations: translationsSource };
    }

    publishedBytes += writeContentFile('inventory', JSON.stringify(inventory));
    published.add('inventory.json');

    // Drop files left behind by an earlier run (a removed language, a renamed kind).
    fs.readdirSync(outputRoot)
        .filter((entry) => entry.endsWith('.json') && !published.has(entry))
        .forEach((entry) => fs.unlinkSync(path.join(outputRoot, entry)));

    const toMb = (bytes) => `${(bytes / 1e6).toFixed(2)} MB`;
    process.stdout.write(
        `content assets: ${published.size - 1} files for ${Object.keys(languages).length} languages, `
        + `${toMb(sourceBytes)} source -> ${toMb(publishedBytes)} published\n`
    );
};

main();
