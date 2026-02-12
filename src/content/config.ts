import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
    type: 'content',
    schema: ({ image }) => z.object({
        title: z.string(),
        description: z.string(),
        date: z.date(),
        image: image().optional(),
        tags: z.array(z.string()).default([]),
        featured: z.boolean().default(false),
    }),
});

export const collections = { blog };
