const fs = require('fs');
const path = require('path');
const dir = path.join(process.cwd(), 'src', 'content', 'blog');

// SEO-optimized descriptions (150-160 chars, compelling, with keywords)
const descriptions = {
    'interior-design-trends-2025': 'From the brown-aissance to curved furniture and limewash walls — here are the 2025 interior design trends actually worth trying, with tips to get the look.',
    'green-bedroom-furniture-ideas': 'Green bedroom furniture can be a showstopper when styled right. Tips on pairing sage, olive and emerald pieces with warm neutrals, wood tones and soft lighting.',
    'japandi-living-room-ideas': 'Japandi living room ideas for 2025: low-profile furniture, warm neutral palettes, paper pendant lights and organic textures. Plus shoppable picks for every budget.',
    'japandi-bedroom-trends-warm-neutrals': 'Create a Japandi bedroom that calms you the moment you walk in. Warm neutrals, organic shapes, low platform beds and layered linen — a practical 2025 guide.',
    'limewash-living-rooms-warm-textured': 'Limewash walls bring depth, texture and old-world charm to any living room. Colour picks, application tips, furniture pairings and shoppable essentials inside.',
    'modern-living-room-decor-2025-40-expert-ideas': '40 expert-backed modern living room ideas for 2025 — from curved sofas and travertine accents to layered lighting and earthy colour palettes you can actually recreate.',
    'top-10-floor-decor-new-york': 'Living in NYC? These 10 floor decor ideas — statement rugs, sculptural planters, modern lamps — turn any compact apartment into a stylish, design-forward space.',
    'christmas-tree-decoration-ideas': '33 Christmas tree ideas for 2025: minimalist Scandinavian, rustic farmhouse, small-space solutions and bold colour themes. Budget-friendly tips for every style.',
    'valentine-decoration-ideas-for-home': '15 Valentine decoration ideas that feel romantic without the cheese. Soft lighting, textured throws, scented candles and subtle colour palettes for every room.',
    'how-to-style-clay-terracotta-natural-materials-modern-homes': 'How to bring clay, terracotta and natural materials into a modern home without it looking rustic. Practical tips for walls, planters, textiles and accent pieces.',
    '10-designer-secrets-budget-friendly-minimalist-living-room': '10 designer-approved tricks for a minimalist living room on a budget. Quality sofa picks, smart storage, gallery walls, and the lighting hack that changes everything.',
};

// Alt text mapping for images without alt text
const altTexts = {
    'Terracota.png': 'Modern living room with terracotta vases, clay wall art and natural wood furniture',
    'planters.png': 'Collection of terracotta planters with green houseplants on a wooden shelf',
    'linen.png': 'Draped linen fabric in warm neutral tones on a wooden surface',
    'pin.png': 'Valentine decorated front entrance with romantic wreath and pink accents',
    'table%20scape.png': 'Romantic Valentine dinner table setting with candles, roses and linen runner',
    'c2.png': 'Modern Christmas tree decorated with warm neutral ornaments and wooden accents',
    'c3.png': 'Small-space Christmas tree idea with minimalist Scandinavian decorations',
    '1.png': 'Cosy living room interior with warm earthy colour palette and textured decor',
    'Gemini_Generated_Image': 'Japandi living room mood board with organic shapes and warm neutral tones',
    'nwxtxzauxpqd9ui34dky': 'Stylish New York apartment living room with statement area rug and floor decor',
    'uccgsaskawtcdua5hqn7': 'Modern floor vase arrangement in a minimalist apartment corner',
    'fvhmsiyu3ppunknr3ebf': 'Decorative floor pouf and knitted basket in a cosy reading nook',
};

const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
files.forEach(f => {
    const slug = f.replace('.md', '');
    const fp = path.join(dir, f);
    let content = fs.readFileSync(fp, 'utf-8');

    // 1. Fix description
    if (descriptions[slug]) {
        content = content.replace(
            /description:\s*".*?"/s,
            'description: "' + descriptions[slug] + '"'
        );
        console.log('  DESC: ' + slug);
    }

    // 2. Fix heading hierarchy: first # stays, all subsequent # become ##
    const fmEnd = content.indexOf('---', content.indexOf('---') + 3);
    if (fmEnd !== -1) {
        const frontmatter = content.substring(0, fmEnd + 3);
        let body = content.substring(fmEnd + 3);

        let firstH1Found = false;
        body = body.replace(/^(#{1,6})\s+(.*)$/gm, (match, hashes, text) => {
            if (hashes === '#') {
                if (!firstH1Found) {
                    firstH1Found = true;
                    return match; // Keep first H1
                }
                return '## ' + text; // Demote subsequent H1s to H2
            }
            return match;
        });

        content = frontmatter + body;
        console.log('  H1s fixed: ' + slug);
    }

    // 3. Add alt text to images missing it
    content = content.replace(/!\[\]\((https?:\/\/[^)]+)\)/g, (match, url) => {
        for (const [key, alt] of Object.entries(altTexts)) {
            if (url.includes(key)) {
                return '![' + alt + '](' + url + ')';
            }
        }
        // Fallback: generate from filename
        const filename = url.split('/').pop().split('?')[0].replace(/\.\w+$/, '').replace(/%20/g, ' ');
        const fallbackAlt = 'Interior design inspiration — ' + filename;
        return '![' + fallbackAlt + '](' + url + ')';
    });

    fs.writeFileSync(fp, content);
    console.log('✓ ' + f);
});
console.log('Done!');
