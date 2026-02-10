import fs from 'fs';
import path from 'path';

// ──────────────────────────────────────────────────────────
//  Mitti & Moss — Blogger Atom → Astro Markdown Migrator
// ──────────────────────────────────────────────────────────

function extractTag(xml, tag) {
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
    const m = xml.match(re);
    return m ? m[1].trim() : '';
}

function unescapeHtml(str) {
    return str
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&');
}

function stripAllTags(html) {
    return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function htmlToMarkdown(html) {
    let md = html;

    // ── 0. Remove Angular / Blogger junk ──
    md = md.replace(/<source-footnote[\s\S]*?<\/source-footnote>/gi, '');
    md = md.replace(/<sources-carousel-inline[\s\S]*?<\/sources-carousel-inline>/gi, '');
    md = md.replace(/<source-inline-chip[s]?[\s\S]*?<\/source-inline-chip[s]?>/gi, '');
    md = md.replace(/<button[\s\S]*?<\/button>/gi, '');
    md = md.replace(/<mat-icon[\s\S]*?<\/mat-icon>/gi, '');
    md = md.replace(/<sup[\s\S]*?<\/sup>/gi, '');
    md = md.replace(/<!--[\s\S]*?-->/g, '');

    // ── 1. Strip citation/junk spans ──
    md = md.replace(/<span[^>]*class="[^"]*citation[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '$1');
    md = md.replace(/<span[^>]*>([\s\S]*?)<\/span>/gi, '$1');

    // ── 2. Fix <code>[Product Link: <a href="url">Text</a>]</code> → keep inner <a> ──
    // The original HTML has: <code>[Product Link: <a href="...">Text</a>]</code>
    // We want to strip the <code> wrapper and [Product Link: ] text, keeping just the <a>
    md = md.replace(/<code>\s*\[Product Link:\s*([\s\S]*?)\]\s*<\/code>/gi, '$1');
    // Strip any remaining <code>...</code> blocks
    md = md.replace(/<code>([\s\S]*?)<\/code>/gi, '$1');

    // ── 3. Remove Google Search tracking links, keep text ──
    md = md.replace(/<a\b[^>]*href=["']https?:\/\/(?:www\.)?google\.com\/search[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi, '$1');

    // ── 4. Remove <a> wrappers around images (Blogger wraps imgs in links to full-size) ──
    md = md.replace(/<a\b[^>]*href=["'][^"']*blogger[^"']*["'][^>]*>\s*(<img[^>]*>)\s*<\/a>/gi, '$1');
    md = md.replace(/<a\b[^>]*>\s*(<img[^>]*>)\s*<\/a>/gi, '$1');

    // ── 5. Structural HTML → Markdown ──
    md = md.replace(/<\/?(header|section|article|main|footer|nav|figure|figcaption|aside)[^>]*>/gi, '');
    md = md.replace(/<div[^>]*>/gi, '');
    md = md.replace(/<\/div>/gi, '');

    // Headings — capture content, convert to markdown
    md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, text) => {
        const clean = text.replace(/<[^>]+>/g, '').trim();
        return clean ? `\n\n## ${clean}\n` : '';
    });
    md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, text) => {
        const clean = text.replace(/<[^>]+>/g, '').trim();
        return clean ? `\n\n## ${clean}\n` : '';
    });
    md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, text) => {
        const clean = text.replace(/<[^>]+>/g, '').trim();
        return clean ? `\n\n### ${clean}\n` : '';
    });
    md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, (_, text) => {
        const clean = text.replace(/<[^>]+>/g, '').trim();
        return clean ? `\n\n#### ${clean}\n` : '';
    });

    // Paragraphs & line breaks
    md = md.replace(/<br\s*\/?>/gi, '\n');
    md = md.replace(/<p[^>]*>/gi, '\n\n');
    md = md.replace(/<\/p>/gi, '');

    // Bold / Strong
    md = md.replace(/<(?:b|strong)>([\s\S]*?)<\/(?:b|strong)>/gi, '**$1**');
    // Italic / Em
    md = md.replace(/<(?:i|em)>([\s\S]*?)<\/(?:i|em)>/gi, '*$1*');

    // Lists
    md = md.replace(/<ul[^>]*>/gi, '\n');
    md = md.replace(/<\/ul>/gi, '\n');
    md = md.replace(/<ol[^>]*>/gi, '\n');
    md = md.replace(/<\/ol>/gi, '\n');
    md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');

    // Images → Markdown
    md = md.replace(/<img[^>]*alt=["']([^"']*)["'][^>]*src=["']([^"']+)["'][^>]*\/?>/gi, '![$1]($2)');
    md = md.replace(/<img[^>]*src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*\/?>/gi, '![$2]($1)');
    md = md.replace(/<img[^>]*src=["']([^"']+)["'][^>]*\/?>/gi, '![]($1)');

    // Links → Markdown links
    md = md.replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');

    // ── 6. Cleanup ──
    // Remove ANY remaining HTML tags
    md = md.replace(/<[^>]+>/g, '');

    // Decode entities
    md = md.replace(/&nbsp;/g, ' ');
    md = md.replace(/&amp;/g, '&');
    md = md.replace(/&lt;/g, '<');
    md = md.replace(/&gt;/g, '>');
    md = md.replace(/&quot;/g, '"');

    // Fix run-on headers: "text## Header" → "text\n\n## Header"
    md = md.replace(/([^\n])(#{1,6}\s)/g, '$1\n\n$2');

    // Fix list items that have blank line then bold text: "- \n\n**" → "- **"
    md = md.replace(/-\s*\n\s*\n\s*\*\*/g, '- **');

    // Remove lonely "#" lines (from empty heading tags)
    md = md.replace(/^#+\s*$/gm, '');

    // Strip `[Product Link: ...]` wrapper from markdown text if any remain after conversion
    // Pattern: `[Product Link: [Text](url)]` → [Text](url)
    md = md.replace(/`?\[Product Link:\s*(\[[^\]]+\]\([^)]+\))\s*\]`?/g, '$1');

    // Collapse excessive blank lines
    md = md.replace(/\n{3,}/g, '\n\n');

    // ── 7. Fix internal links ──
    md = md.replace(/https?:\/\/(?:www\.)?mittiandmoss\.com\/(\d{4})\/(\d{2})\/([^")\s]+)\.html[?]?/g, (match, y, m, slug) => {
        return `/blog/${slug}`;
    });
    md = md.replace(/https?:\/\/(?:www\.)?mittiandmoss\.com\/p\/([^")\s]+)\.html/g, (match, slug) => {
        return `/blog/${slug}`;
    });

    return md.trim();
}

async function migrate() {
    const atomFile = path.join(process.cwd(), 'feed.atom');
    if (!fs.existsSync(atomFile)) {
        console.error('feed.atom not found!');
        return;
    }

    const xml = fs.readFileSync(atomFile, 'utf-8');
    const entries = xml.split('<entry>').slice(1);
    console.log(`Found ${entries.length} entries.`);

    const redirects = [];
    let count = 0;

    for (const entry of entries) {
        if (!entry.includes('</entry>')) continue;

        const title = unescapeHtml(extractTag(entry, 'title'))
            .replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '');

        const published = extractTag(entry, 'published');
        const updated = extractTag(entry, 'updated');
        const date = new Date(published || updated);

        const rawContent = extractTag(entry, 'content');
        const content = unescapeHtml(rawContent)
            .replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '');

        // Hero image (first img)
        let heroImage = '';
        const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
        if (imgMatch) heroImage = imgMatch[1];

        // Convert
        let markdown = htmlToMarkdown(content);

        // Remove duplicated hero image at start of body
        if (heroImage) {
            // Try various alt-text patterns
            const heroPatterns = [
                `![](${heroImage})`,
            ];
            for (const pat of heroPatterns) {
                if (markdown.startsWith(pat)) {
                    markdown = markdown.slice(pat.length).trim();
                    break;
                }
            }
            // Also try regex for hero image with any alt
            const heroRe = new RegExp(`^!\\[[^\\]]*\\]\\(${heroImage.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`, 'm');
            markdown = markdown.replace(heroRe, '').trim();
        }

        // Extract slug
        let originalUrl = '';
        const linkMatch = entry.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["'][^>]*\/?>/i);
        if (linkMatch) originalUrl = linkMatch[1];
        if (!originalUrl) {
            const fMatch = entry.match(/<blogger:filename>([^<]+)<\/blogger:filename>/i);
            if (fMatch) originalUrl = fMatch[1];
        }
        if (!originalUrl) {
            console.log(`  Skipping "${title}" — no URL`);
            continue;
        }

        const urlParts = originalUrl.split('/');
        const slug = urlParts[urlParts.length - 1].replace('.html', '');
        if (!slug) continue;

        // Description (plain text, max 160 chars)
        const plainText = stripAllTags(content);
        const desc = plainText.slice(0, 155).replace(/"/g, '\\"') + '...';

        // Write file
        const fileContent = `---
title: "${title.replace(/"/g, '\\"')}"
description: "${desc}"
date: ${date.toISOString()}
image: "${heroImage}"
active: true
tags: ["interior", "decor"]
---

${markdown}
`;

        const fileName = `${slug}.md`;
        const filePath = path.join(process.cwd(), 'src', 'content', 'blog', fileName);
        fs.writeFileSync(filePath, fileContent);
        console.log(`  ✓ ${fileName}`);

        // Redirect
        try {
            let oldPath = originalUrl;
            if (originalUrl.startsWith('http')) {
                oldPath = new URL(originalUrl).pathname;
            }
            if (!oldPath.startsWith('/')) oldPath = '/' + oldPath;
            redirects.push(`${oldPath} /blog/${slug} 301`);
        } catch (e) { }

        count++;
    }

    const redirectFile = path.join(process.cwd(), 'public', '_redirects');
    fs.writeFileSync(redirectFile, redirects.join('\n'));
    console.log(`\n✓ ${count} posts migrated, ${redirects.length} redirects saved.`);
}

migrate().catch(console.error);
