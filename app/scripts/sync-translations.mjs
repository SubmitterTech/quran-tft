#!/usr/bin/env node
/**
 * Makes sure the translations are there before anything reads them.
 *
 * They are a git submodule under src/assets/translations that follows the release branch of
 * SubmitterTech/quran-tft-translations: what the bot there pulled from Transifex and what its
 * checks let through. This repository records one commit of it, the one the last mobile
 * release was built from.
 *
 *   node scripts/sync-translations.mjs           check them out if they are not; else leave them
 *   node scripts/sync-translations.mjs update    move to the tip of the release branch
 *   node scripts/sync-translations.mjs pin       the same, and stage that commit in this repository
 *
 * On Cloudflare a build always moves to the tip. The sites publish the latest released text,
 * whichever commit of this repository they are built from, so a new translation never needs a
 * commit here.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mount = path.join('src', 'assets', 'translations');
const catalog = path.join(appRoot, mount, 'languages.json');

// The branch that only holds what passed the checks. .gitmodules names it too.
const RELEASE_BRANCH = 'release';

// Both set by Cloudflare itself, for Workers Builds and for Pages.
const onCloudflare = Boolean(process.env.WORKERS_CI || process.env.CF_PAGES);
const mode = process.argv[2] || (onCloudflare ? 'update' : 'ensure');

const git = (...args) => execFileSync('git', args, { cwd: appRoot, stdio: 'inherit' });
const read = (...args) => execFileSync('git', args, { cwd: appRoot, encoding: 'utf8' }).trim();

// A checked out submodule has a .git entry of its own. The files in it do not say: an older
// commit of the translations has no catalog, and is a checkout all the same.
const isCheckedOut = () => fs.existsSync(path.join(appRoot, mount, '.git'));

const fail = (message) => {
    process.stderr.write(`translations: ${message}\n`);
    process.exit(1);
};

if (!['ensure', 'update', 'pin'].includes(mode)) {
    fail(`unknown mode "${mode}". Use no argument, "update" or "pin".`);
}

// A copy of the tree without git in it (an archive, a build context) cannot be moved, but
// with the files in place there is nothing to do for it either.
const filesWithoutGit = mode === 'ensure' && !isCheckedOut() && fs.existsSync(catalog);

try {
    // An existing checkout is never moved by this step: it may be on purpose where it is.
    if (!isCheckedOut() && !filesWithoutGit) {
        git('submodule', 'update', '--init', '--', mount);
    }

    if (mode !== 'ensure') {
        // The branch is asked for by name. A checkout that a build system made shallow only
        // knows the default branch, and the release branch is not it.
        git('-C', mount, 'fetch', '--quiet', 'origin',
            `+refs/heads/${RELEASE_BRANCH}:refs/remotes/origin/${RELEASE_BRANCH}`);
        // Not quiet: if commits made in the checkout are being left behind, git says so here.
        git('-C', mount, 'checkout', '--detach', `refs/remotes/origin/${RELEASE_BRANCH}`);
    }
} catch (error) {
    fail(
        'the submodule could not be brought up to date. Check the connection, and that the '
        + 'checkout under src/assets/translations has no changes of its own in the way.'
    );
}

if (!fs.existsSync(catalog)) {
    fail(
        `${path.join(mount, 'languages.json')} is missing, so the app has no language catalog to build with. `
        + 'The checkout there was left as it is; "npm run translations:update" moves it to the latest release.'
    );
}

if (mode === 'pin') {
    // The submodule is left out of status and of "commit -a" (ignore = all in .gitmodules),
    // so that following the release branch never shows up as a change. Recording a new commit
    // is therefore a deliberate act, and needs --force.
    git('add', '--force', '--', mount);
}

if (mode !== 'ensure') {
    const commit = read('-C', mount, 'log', '-1', '--format=%h %cs %s');
    process.stdout.write(`translations: ${mode === 'pin' ? 'staged' : 'now at'} ${commit}\n`);
}
