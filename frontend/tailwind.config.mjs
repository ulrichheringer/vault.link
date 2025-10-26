/** @type {import('tailwindcss').Config} */
export default {
    content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
    theme: {
        extend: {
            colors: {
                'bg-dark': '#000000',
                'bg-card': '#1a1a1a',
            },
        },
    },
    plugins: [],
}
