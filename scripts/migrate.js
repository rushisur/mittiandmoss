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

    // Split entries (naive but works for Atom usually)
    const entries = xml.split('<entry>').slice(1);

    console.log(`Found ${entries.length} entries.`);

    const redirects = [];
    let count = 0;

    for (const entry of entries) {
        if (!entry.includes('</entry>')) continue;

        // Extract metadata
        const rawTitle = extractTag(entry, 'title');
        const title = unescapeHtml(rawTitle)
            .replace(/<!\[CDATA\[/g, '')
            .replace(/\]\]>/g, '');

        const published = extractTag(entry, 'published');
        const updated = extractTag(entry, 'updated');

        // Extract content and unescape it so we get actual HTML tags back
        // The Atom feed stores HTML as escaped string inside <content type='html'>
        const rawContent = extractTag(entry, 'content');
        const content = unescapeHtml(rawContent)
            .replace(/<!\[CDATA\[/g, '')
            .replace(/\]\]>/g, '');

        // Extract original link for redirect
        let originalUrl = '';
        const linkMatch = entry.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["'][^>]*\/?>/i);
        if (linkMatch) {
            originalUrl = linkMatch[1];
        } else {
            // Fallback for Blogger export format
            const filenameMatch = entry.match(/<blogger:filename>([^<]+)<\/blogger:filename>/i);
            if (filenameMatch) {
                originalUrl = filenameMatch[1];
            }
        }

        if (!originalUrl) {
            console.log(`Skipping entry "${title}" - No URL found`);
            continue;
        }

        // Parse slug from URL
        let slug = '';
        const urlParts = originalUrl.split('/');
        const lastPart = urlParts[urlParts.length - 1];
        slug = lastPart.replace('.html', '');

        if (!slug) continue;

        const date = new Date(published || updated);

        // Basic HTML -> Markdown conversion
        let markdown = content
            .replace(/<header>([\s\S]*?)<\/header>/i, '') // Remove Blogger auto-generated header if present? 
            // Actually, looking at the feed, <header> seems to contain the main image and intro?
            // "Decorating a bedroom..." is inside <header>. So we KEEP it but strip tags.
            .replace(/<header>/gi, '')
            .replace(/<\/header>/gi, '')
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
            .replace(/<h1[^>]*>/gi, '# ')
            .replace(/<\/h1>/gi, '\n')
            .replace(/<h2[^>]*>/gi, '## ')
            .replace(/<\/h2>/gi, '\n')
            .replace(/<h3[^>]*>/gi, '### ')
            .replace(/<\/h3>/gi, '\n')
            .replace(/<ul[^>]*>/gi, '')
            .replace(/<\/ul>/gi, '')
            .replace(/<li[^>]*>/gi, '- ')
            .replace(/<\/li>/gi, '\n')
            .replace(/<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, '[$2]($1)')
            .replace(/<img[^>]*src=["']([^"']+)["'][^>]*\/?>/gi, '![]($1)');

        // Clean up entities again if any remain
        markdown = markdown.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');

        // Create Frontmatter
        const fileContent = `---
title: "${title.replace(/"/g, '\\"')}"
description: "${markdown.slice(0, 150).replace(/\n/g, ' ').replace(/"/g, '\\"') + '...'}"
date: ${date.toISOString()}
image: ""
active: true
tags: ["interior", "decor"]
---

${markdown}
`;

        const fileName = `${slug}.md`;
        const filePath = path.join(process.cwd(), 'src', 'content', 'blog', fileName);

        fs.writeFileSync(filePath, fileContent);
        console.log(`Created: ${fileName}`);

        // Add Redirect
        try {
            let oldPath = originalUrl;
            if (originalUrl.startsWith('http')) {
                const urlObj = new URL(originalUrl);
                oldPath = urlObj.pathname;
            }
            if (!oldPath.startsWith('/')) oldPath = '/' + oldPath;

            // Target: redirect to .html to match current Astro slug generation strategy
            // Wait, Astro generates /blog/slug/index.html by default (directory) OR /blog/slug.html?
            // Default is directory. /blog/slug/
            // So redirect should depend on Astro config.
            // Assuming standard: /blog/${slug}

            redirects.push(`${oldPath} /blog/${slug} 301`);
        } catch (e) {
            console.warn(`Skipping redirect for invalid URL: ${originalUrl}`);
        }

        count++;
    }

    // Write _redirects file
    const redirectFile = path.join(process.cwd(), 'public', '_redirects');
    fs.writeFileSync(redirectFile, redirects.join('\n'));
    console.log(`\nGenerated ${redirects.length} redirects in public/_redirects`);
}

migrate().catch(console.error);
