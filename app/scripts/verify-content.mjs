#!/usr/bin/env node
/**
 * Last check before a deploy: is what was just built at least what is live?
 *
 * Installed apps take any file that differs from theirs as newer, and readers on the web get
 * whatever is deployed. So a build that lost a language or a file, or that carries older
 * translations than the site it would replace, is stopped here. The build command fails,
 * nothing is deployed, and the live site stays as it is.
 *
 * It runs on Cloudflare, and before a deploy made by hand (CONTENT_VERIFY=1, which
 * "npm run deploy:cloudflare" sets). Anywhere else a build with fewer languages, or with
 * English alone, is a valid build.
 *
 * ALLOW_CONTENT_REGRESSION=1 lets a build through on purpose, for the day a language is
 * really taken out.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const builtPath = path.join(appRoot, 'build', 'content', 'inventory.json');
const translationsRoot = path.join(appRoot, 'src', 'assets', 'translations');

// Both set by Cloudflare itself. The Pages project is the Turkish site, the Worker the main one.
const onCloudflare = Boolean(process.env.WORKERS_CI || process.env.CF_PAGES);
// A build made on a developer's machine keeps the translations it has, which are usually
// older than the live ones. Deploying that by hand is held to the same check.
const enforced = onCloudflare || process.env.CONTENT_VERIFY === '1';
const liveOrigin = process.env.CONTENT_LIVE_ORIGIN
    || (process.env.CF_PAGES ? 'https://sonahit.org' : 'https://qurantft.com');

const say = (message) => process.stdout.write(`content check: ${message}\n`);

const readLive = async () => {
    const response = await fetch(`${liveOrigin}/content/inventory.json`, {
        signal: AbortSignal.timeout(15000),
        cache: 'no-store',
    });
    const type = response.headers.get('content-type') || '';
    // A missing file comes back as the app shell with status 200, so the type decides.
    if (!response.ok || !type.includes('json')) {
        throw new Error(`status ${response.status}, type ${type || 'unknown'}`);
    }
    return response.json();
};

// Git, asked inside the translations checkout. True when the command succeeds.
const translationsGit = (...args) => {
    try {
        execFileSync('git', ['-C', translationsRoot, ...args], { stdio: 'ignore' });
        return true;
    } catch (error) {
        return false;
    }
};

const isShallow = () => {
    try {
        return execFileSync('git', ['-C', translationsRoot, 'rev-parse', '--is-shallow-repository'], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim() === 'true';
    } catch (error) {
        return true;
    }
};

const isCommitId = (value) => typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);

/**
 * Do the translations of this build come after the live ones? Decided by history, not by
 * dates: a commit's date says when its author's clock was read, not where it stands.
 * Returns 'same', 'newer', 'older', or 'unknown' when history cannot answer.
 */
const compareTranslations = (liveCommit, builtCommit) => {
    if (liveCommit === builtCommit) {
        return 'same';
    }
    const known = (commit) => translationsGit('cat-file', '-e', `${commit}^{commit}`);
    const follows = () => translationsGit('merge-base', '--is-ancestor', liveCommit, builtCommit);

    if (!known(builtCommit)) {
        return 'unknown';
    }
    if (!known(liveCommit)) {
        // A build of an older state does not have the newer commit yet. Ask for it.
        translationsGit('fetch', '--quiet', 'origin', liveCommit);
    }
    if (!known(liveCommit)) {
        return 'unknown';
    }
    if (follows()) {
        return 'newer';
    }
    // A shallow checkout cannot see past its edge and would call a real ancestor a stranger.
    // If the rest of the history cannot be fetched either, the answer is not known.
    translationsGit('fetch', '--quiet', '--unshallow', 'origin');
    if (follows()) {
        return 'newer';
    }
    return isShallow() ? 'unknown' : 'older';
};

const main = async () => {
    if (!enforced) {
        return;
    }

    const built = JSON.parse(fs.readFileSync(builtPath, 'utf8'));

    let live;
    try {
        live = await readLive();
    } catch (error) {
        // With nothing to compare with there is nothing to protect, and a site that is down
        // must not be kept down by this.
        say(`${liveOrigin} did not give its inventory (${error.message}); nothing to compare with.`);
        return;
    }

    const problems = [];

    Object.entries(live.languages || {}).forEach(([lang, entry]) => {
        const kinds = built.languages?.[lang]?.kinds;
        if (!kinds) {
            problems.push(`"${lang}" is live and missing from this build`);
            return;
        }
        (entry.kinds || []).filter((kind) => !kinds.includes(kind)).forEach((kind) => {
            problems.push(`${kind}_${lang} is live and missing from this build`);
        });
    });

    const liveCommit = live.source?.translations?.commit;
    const builtCommit = built.source?.translations?.commit;
    if (isCommitId(liveCommit)) {
        if (!isCommitId(builtCommit)) {
            problems.push('this build does not say which translations it carries, and the live site does');
        } else {
            const order = compareTranslations(liveCommit, builtCommit);
            if (order === 'older') {
                problems.push(
                    `this build carries translations ${builtCommit.slice(0, 7)}, `
                    + `which do not include the live ones, ${liveCommit.slice(0, 7)}`
                );
            } else if (order === 'unknown') {
                say(`the live translations, ${liveCommit.slice(0, 7)}, could not be placed in history; not compared.`);
            }
        }
    }

    if (problems.length === 0) {
        say(`nothing lost compared with ${liveOrigin}.`);
        return;
    }

    problems.forEach((problem) => say(problem));
    if (process.env.ALLOW_CONTENT_REGRESSION === '1') {
        say('let through on purpose (ALLOW_CONTENT_REGRESSION=1).');
        return;
    }
    say(`not deploying. ${liveOrigin} stays as it is.`);
    process.exit(1);
};

main().catch((error) => {
    process.stderr.write(`content check failed to run: ${error.message}\n`);
    process.exit(1);
});
