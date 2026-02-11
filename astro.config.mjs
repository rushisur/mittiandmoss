// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import rehypeExternalLinks from 'rehype-external-links';

// https://astro.build/config
export default defineConfig({
    site: 'https://mittiandmoss.com',
    output: 'static',
    integrations: [sitemap()],
    markdown: {
        rehypePlugins: [
            [rehypeExternalLinks, {
                target: '_blank',
                rel: (element) => {
                    const href = element.properties?.href || '';
                    if (typeof href === 'string' && (href.includes('amzn.to') || href.includes('amazon.com'))) {
                        return ['nofollow', 'sponsored', 'noopener'];
                    }
                    return ['noopener', 'noreferrer'];
                },
                content: undefined,
            }],
        ],
    },
    build: {
        assets: '_assets',
    },
    vite: {
        css: {
            preprocessorOptions: {},
        },
    },
});
