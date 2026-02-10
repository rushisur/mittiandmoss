import fs from 'fs';
import path from 'path';

// Helper to extract content between tags
function extractTag(content, tag) {
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
    const match = content.match(regex);
    return match ? match[1].trim() : '';
}

// Helper to unescape HTML entities
function unescapeHtml(str) {
    return str
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&');
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

        // 1. Extract raw metadata
        const rawTitle = extractTag(entry, 'title');
        const title = unescapeHtml(rawTitle)
            .replace(/<!\[CDATA\[/g, '')
            .replace(/\]\]>/g, '');

        const published = extractTag(entry, 'published');
        const updated = extractTag(entry, 'updated');
        const date = new Date(published || updated);

        // 2. Extract content
        const rawContent = extractTag(entry, 'content');
        let content = unescapeHtml(rawContent)
            .replace(/<!\[CDATA\[/g, '')
            .replace(/\]\]>/g, '');

        // 3. Extract Hero Image (First <img> found)
        let heroImage = "";
        const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
        if (imgMatch) {
            heroImage = imgMatch[1];
        }

        // 4. Clean up specific Google/Blogger junk (Smart Links)
        // Remove links to google.com/search?q=... but keep link text
        // Handle attributes in any order, multi-line, etc.
        content = content.replace(/<a\b[^>]*href=["']https?:\/\/(?:www\.)?google\.com\/search\?[^"']+["'][^>]*>([\s\S]*?)<\/a>/gi, '$1');

        // 5. Affiliate Link Handling (Amazon)
        // Post-process Amazon links in Markdown instead of HTML to be cleaner? 
        // No, standard markdown doesn't support target="_blank".
        // We must stick to HTML for these specific links if we want new tabs.
        // Or we convert to markdown and trust the user to add a script?
        // User requested "correct". Correct usually means new tab for external/affiliate.
        // Let's use HTML for Amazon links.

        content = content.replace(/<a\b([^>]*href=["'](?:https?:\/\/(?:www\.)?(?:amazon\.com|amzn\.to)[^"']*)["'][^>]*)>([\s\S]*?)<\/a>/gi, (match, attrs, text) => {
            let newAttrs = attrs;
            if (!newAttrs.includes('target=')) newAttrs += ' target="_blank"';
            if (!newAttrs.includes('rel=')) newAttrs += ' rel="nofollow sponsored"';
            return `<a${newAttrs}>${text}</a>`;
        });

        // 6. Basic HTML -> Markdown conversion

        content = content.replace(/<header>[\s\S]*?<\/header>/gi, '');

        let markdown = content
            .replace(/<section>/gi, '')
            .replace(/<\/section>/gi, '')
            .replace(/<div[^>]*>/gi, '')
            .replace(/<\/div>/gi, '')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<p>/gi, '\n\n')
            .replace(/<\/p>/gi, '')
            .replace(/<b>/gi, '**').replace(/<\/b>/gi, '**')
            .replace(/<strong>/gi, '**').replace(/<\/strong>/gi, '**')
            .replace(/<i>/gi, '*').replace(/<\/i>/gi, '*')
            .replace(/<em>/gi, '*').replace(/<\/em>/gi, '*')

            .replace(/<h[1-6][^>]*>/gi, '\n\n## ')
            .replace(/<\/h[1-6]>/gi, '\n')

            .replace(/<ul[^>]*>/gi, '\n')
            .replace(/<\/ul>/gi, '\n')
            .replace(/<li[^>]*>/gi, '\n- ')
            .replace(/<\/li>/gi, '')

            .replace(/<img[^>]+src=["']([^"']+)["'][^>]*\/?>/gi, '\n![]($1)\n')

            // Convert remaining <a> to markdown (Amazon links might be caught here if they are simple <a>? 
            // No, my regex above outputted <a ...> which matches <a ...>
            // So I need to NOT convert valid HTML <a> tags if I want to keep them.
            // But standard markdown link replacement `replace(/<a...>(.*)<\/a>/, '[$1]($2)')` is aggressive.
            // I will skip this replacement for now and let the user decide?
            // No, I'll allow ALL links to be Markdown for consistency, EXCEPT Amazon.
            // So I need a negative lookahead? Or just process Amazon first to a placeholder.

            // Better strategy: Convert EVERYTHING to Markdown. 
            // If user wants target="_blank", I can add a rehype plugin to Astro config later.
            // That is the "Astro way".
            // So I will convert Amazon links to standard Markdown too.
            .replace(/<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, '[$2]($1)');

        // 7. Post-Markdown Cleanup
        markdown = markdown
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/\n\s*\n\s*\n/g, '\n\n')
            .trim();

        // Fix headers
        markdown = markdown.replace(/([^\n])(##+ )/g, '$1\n\n$2');

        // Remove hero image from body
        if (heroImage && markdown.startsWith(`![](${heroImage})`)) {
            markdown = markdown.replace(`![](${heroImage})`, '').trim();
        }

        // 8. Extract Slug & Redirects
        let originalUrl = '';
        const linkMatch = entry.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["'][^>]*\/?>/i);
        if (linkMatch) originalUrl = linkMatch[1];
        if (!originalUrl) {
            const fMatch = entry.match(/<blogger:filename>([^<]+)<\/blogger:filename>/i);
            if (fMatch) originalUrl = fMatch[1];
        }

        if (!originalUrl) continue;

        const urlParts = originalUrl.split('/');
        const slug = urlParts[urlParts.length - 1].replace('.html', '');

        // Frontmatter construction
        const fileContent = `---
title: "${title.replace(/"/g, '\\"')}"
description: "${markdown.slice(0, 150).replace(/\n/g, ' ').replace(/"/g, '\\"') + '...'}"
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
        console.log(`Rewrote: ${fileName}`);

        // Redirect Rule
        try {
            let oldPath = originalUrl;
            if (originalUrl.startsWith('http')) {
                const urlObj = new URL(originalUrl);
                oldPath = urlObj.pathname;
            }
            if (!oldPath.startsWith('/')) oldPath = '/' + oldPath;
            redirects.push(`${oldPath} /blog/${slug} 301`);
        } catch (e) { }

        count++;
    }

    const redirectFile = path.join(process.cwd(), 'public', '_redirects');
    fs.writeFileSync(redirectFile, redirects.join('\n'));
    console.log(`\nUpdated ${redirects.length} redirects.`);
}

migrate().catch(console.error);
