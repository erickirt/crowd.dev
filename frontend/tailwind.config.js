/* eslint-disable */
const { getThemeReplacementsValues } = require('./.tailwind/colorConverter.js');
// tailwind.config.js
const plugin = require('tailwindcss/plugin')


const themeReplacements = getThemeReplacementsValues();

const spacing = {
  0.5: '0.125rem',
  1: '0.25rem',
  1.5: '0.375rem',
  2: '0.5rem',
  2.5: '0.625rem',
  3: '0.75rem',
  3.5: '0.875rem',
  4: '1rem',
  4.5: '1.125rem',
  5: '1.25rem',
  5.5: '1.375rem',
  6: '1.5rem',
  6.5: '1.625rem',
  7: '1.75rem',
  7.5: '1.875rem',
  8: '2rem',
  8.5: '2.125rem',
  9: '2.25rem',
  9.5: '2.375rem',
  10: '2.5rem',
  10.5: '2.625rem',
  11: '2.75rem',
  11.5: '2.875rem',
  12: '3rem',
  12.5: '3.125rem',
  13: '3.25rem',
  17: '4.25rem',
  18: '4.5rem',
  19: '4.75rem',
  21: '5.25rem',
  30: '7.5rem',
  34: '8.5rem',
  42: '10.5rem',
  43: '10.75rem',
  48: '12rem',
  50: '12.5rem',
  52: '13rem',
  53: '13.25rem',
  54: '13.5rem',
  55: '13.75rem',
  56: '14rem',
  57: '14.25rem',
  58: '14.5rem',
  59: '14.75rem',
  66: '16.125rem',
  65: '16.25rem',
  68: '17rem',
  70: '17.5rem',
  76: '19rem',
  88: '22rem',
  100: '25rem',
  104: '26rem',
  112: '28rem',
  120: '30rem',
  148: '37rem',
  254: '63.5rem',
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    configViewer: {
      themeReplacements,
    },
    container: {
      center: true,
      screens: {
        lg: '1280px',
      },
    },
    fontFamily: {
      primary: ['var(--lf-font-primary)', 'sans-serif'],
      secondary: ['var(--lf-font-secondary)', 'sans-serif'],
    },

    extend: {
      screens: {
        sm: {
          max: '768px',
        },
        md: {
          min: '768px',
          max: '1280px',
        },
      },
      colors: {
        transparent: 'var(--lf-color-transparent)',
        black: 'var(--lf-color-black)',
        white: 'var(--lf-color-white)',
        background: 'var(--lf-color-background)',
        primary: {
          900: 'var(--lf-color-primary-900)',
          800: 'var(--lf-color-primary-800)',
          700: 'var(--lf-color-primary-700)',
          600: 'var(--lf-color-primary-600)',
          500: 'var(--lf-color-primary-500)',
          400: 'var(--lf-color-primary-400)',
          300: 'var(--lf-color-primary-300)',
          200: 'var(--lf-color-primary-200)',
          150: 'var(--lf-color-primary-150)',
          125: 'var(--lf-color-primary-125)',
          100: 'var(--lf-color-primary-100)',
          50: 'var(--lf-color-primary-50)',
          25: 'var(--lf-color-primary-25)',
        },
        secondary: {
          500: 'var(--lf-color-secondary-500)',
          400: 'var(--lf-color-secondary-400)',
          300: 'var(--lf-color-secondary-300)',
          200: 'var(--lf-color-secondary-200)',
          100: 'var(--lf-color-secondary-100)',
          50: 'var(--lf-color-secondary-50)',
        },
        gray: {
          900: 'var(--lf-color-gray-900)',
          800: 'var(--lf-color-gray-800)',
          700: 'var(--lf-color-gray-700)',
          600: 'var(--lf-color-gray-600)',
          500: 'var(--lf-color-gray-500)',
          400: 'var(--lf-color-gray-400)',
          300: 'var(--lf-color-gray-300)',
          250: 'var(--lf-color-gray-250)',
          200: 'var(--lf-color-gray-200)',
          100: 'var(--lf-color-gray-100)',
          50: 'var(--lf-color-gray-50)',
        },
        red: {
          900: 'var(--lf-color-red-900)',
          800: 'var(--lf-color-red-800)',
          700: 'var(--lf-color-red-700)',
          600: 'var(--lf-color-red-600)',
          500: 'var(--lf-color-red-500)',
          400: 'var(--lf-color-red-400)',
          300: 'var(--lf-color-red-300)',
          200: 'var(--lf-color-red-200)',
          100: 'var(--lf-color-red-100)',
          50: 'var(--lf-color-red-50)',
        },
        yellow: {
          900: 'var(--lf-color-yellow-900)',
          800: 'var(--lf-color-yellow-800)',
          700: 'var(--lf-color-yellow-700)',
          600: 'var(--lf-color-yellow-600)',
          500: 'var(--lf-color-yellow-500)',
          400: 'var(--lf-color-yellow-400)',
          300: 'var(--lf-color-yellow-300)',
          200: 'var(--lf-color-yellow-200)',
          100: 'var(--lf-color-yellow-100)',
          50: 'var(--lf-color-yellow-50)',
        },
        green: {
          1000: 'var(--lf-color-green-1000)',
          900: 'var(--lf-color-green-900)',
          800: 'var(--lf-color-green-800)',
          700: 'var(--lf-color-green-700)',
          600: 'var(--lf-color-green-600)',
          500: 'var(--lf-color-green-500)',
          400: 'var(--lf-color-green-400)',
          300: 'var(--lf-color-green-300)',
          200: 'var(--lf-color-green-200)',
          100: 'var(--lf-color-green-100)',
          50: 'var(--lf-color-green-50)',
        },
        purple: {
          900: 'var(--lf-color-purple-900)',
          800: 'var(--lf-color-purple-800)',
          700: 'var(--lf-color-purple-700)',
          600: 'var(--lf-color-purple-600)',
          500: 'var(--lf-color-purple-500)',
          400: 'var(--lf-color-purple-400)',
          300: 'var(--lf-color-purple-300)',
          200: 'var(--lf-color-purple-200)',
          100: 'var(--lf-color-purple-100)',
          50: 'var(--lf-color-purple-50)',
        },
      },
      spacing,
      borderWidth: {
        3: '3px',
      },
      boxShadow: {
        DEFAULT:
          '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
        '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
      },
      fontSize: {
        '4xs': ['0.5rem'],
        '3xs': ['0.625rem'],
        '2xs': ['0.75rem'],
        xs: ['0.8125rem'],
        lg: ['1.25rem'],
        xl: ['1.5rem'],
        '2xl': ['2rem'],
        '3xl': ['2.5rem'],
        '4xl': ['3rem'],
        '5xl': ['4rem'],
        '8xl': ['8rem'],
        '10xl': ['10rem'],
        h1: [
          'var(--lf-heading-1-font-size)',
          'var(--lf-heading-1-line-height)',
        ],
        h2: [
          'var(--lf-heading-2-font-size)',
          'var(--lf-heading-2-line-height)',
        ],
        h3: [
          'var(--lf-heading-3-font-size)',
          'var(--lf-heading-3-line-height)',
        ],
        h4: [
          'var(--lf-heading-4-font-size)',
          'var(--lf-heading-4-line-height)',
        ],
        h5: [
          'var(--lf-heading-5-font-size)',
          'var(--lf-heading-5-line-height)',
        ],
        h6: [
          'var(--lf-heading-6-font-size)',
          'var(--lf-heading-6-line-height)',
        ],
        xtiny: [
          'var(--lf-text-xtiny-font-size)',
          'var(--lf-text-xtiny-line-height)',
        ],
        tiny: [
          'var(--lf-text-tiny-font-size)',
          'var(--lf-text-tiny-line-height)',
        ],
        small: [
          'var(--lf-text-small-font-size)',
          'var(--lf-text-small-line-height)',
        ],
        medium: [
          'var(--lf-text-medium-font-size)',
          'var(--lf-text-medium-line-height)',
        ],
        large: [
          'var(--lf-text-large-font-size)',
          'var(--lf-text-large-line-height)',
        ],
      },
      letterSpacing: {
        1: '0.0625rem',
        wide: '0.125em',
      },
      lineHeight: {
        loose: '1.75em',
        3.5: '.875rem',
        4.5: '1.125rem',
        15: '3.75rem',
      },
      maxHeight: {
        ...spacing,
      },
      maxWidth: {
        4: '1rem',
        '3.5xs': '10rem',
        '3xs': '12rem',
        '2xs': '16rem',
        ...spacing,
      },
      minHeight: ({ theme }) => ({
        ...theme('spacing'),
        ...spacing,
      }),
      minWidth: {
        ...spacing,
      },
      opacity: {
        15: '0.15',
        35: '0.35',
      },
      transitionProperty: {
        DEFAULT:
          'color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter',
        colors:
          'color, background-color, border-color, text-decoration-color, fill, stroke',
      },
      width: {
        fit: 'fit-content',
      },
      borderRadius: {
        xmd: '0.25rem',
      },
      overflow: {
        unset: 'unset',
      },
    },
  },
  plugins: [
    require('@tailwindcss/line-clamp'),
    plugin(function ({ addUtilities }) {
      addUtilities({
        '.overflow-unset': {
          overflow: 'unset',
        },
        '.overflow-x-unset': {
          'overflow-x': 'unset',
        },
        '.overflow-y-unset': {
          'overflow-y': 'unset',
        },
      });
    }),
  ],
};
