// public/js/admin/services.js
import { API_URL, getHeaders } from './config.js';
import { renderActionButtons } from './ui-components.js';

let currentServices = [];

export function setServicesData(services) {
    currentServices = services;
}

export function renderServicesList() {
    const container = document.getElementById('services-list');
    if (!container) return;
    container.innerHTML = '';

    if (!currentServices || currentServices.length === 0) {
        container.innerHTML = '<p style="color:#666; font-style:italic;">Aucune prestation configurée.</p>';
        return;
    }

    const table = document.createElement('table');
    table.innerHTML = `
        <thead>
            <tr>
                <th style="width: 50px;">Icône</th>
                <th>Nom</th>
                <th>Prix</th>
                <th>Description</th>
                <th style="width: 220px;">Actions</th>
            </tr>
        </thead>
        <tbody id="services-tbody"></tbody>
    `;

    const svgs = {
        cut: '<img src="/images/scissors.png" style="width:20px; height:auto;">',
        razor: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1100 800" width="20" height="20">
  <defs>
    <linearGradient id="lg1" inkscape:collect="always"><stop style="stop-color:#4d4d4d" offset="0"/><stop style="stop-color:#4d4d4d;stop-opacity:0" offset="1"/></linearGradient>
    <linearGradient id="lg2" y2="1518.4" gradientUnits="userSpaceOnUse" x2="791.96" y1="1460" x1="792.65" inkscape:collect="always"><stop style="stop-color:#ffffff" offset="0"/><stop style="stop-color:#ffffff;stop-opacity:0" offset="1"/></linearGradient>
    <filter id="f1" inkscape:collect="always" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="12.897775" inkscape:collect="always"/></filter>
    <radialGradient id="rg1" gradientUnits="userSpaceOnUse" cy="1282.5" cx="740.95" gradientTransform="matrix(-.41197 1.0372 -.64467 -.25606 1933.3 53.754)" r="152" inkscape:collect="always"><stop style="stop-color:#ffffff" offset="0"/><stop style="stop-color:#ffffff;stop-opacity:0" offset="1"/></radialGradient>
    <radialGradient id="rg2" gradientUnits="userSpaceOnUse" cy="953.06" cx="385.58" gradientTransform="matrix(1.885 .33530 -.10953 .61577 -166.02 26.405)" r="384.64" inkscape:collect="always"><stop style="stop-color:#ffffff" offset="0"/><stop style="stop-color:#ffffff;stop-opacity:0" offset="1"/></radialGradient>
    <linearGradient id="lg3" y2="1416.6" gradientUnits="userSpaceOnUse" x2="301.43" gradientTransform="matrix(.83187 -.22148 .22148 .83187 -133.17 -536.81)" y1="1743.8" x1="357.14" inkscape:collect="always"><stop style="stop-color:#d45500" offset="0"/><stop style="stop-color:#d45500;stop-opacity:0" offset="1"/></linearGradient>
    <linearGradient id="lg4" y2="1531.4" gradientUnits="userSpaceOnUse" x2="395.79" gradientTransform="matrix(.83187 -.22148 .22148 .83187 -133.17 -536.81)" y1="1695.7" x1="411.65" inkscape:collect="always"><stop style="stop-color:#552200" offset="0"/><stop style="stop-color:#803300" offset=".54319"/><stop style="stop-color:#ab4400" offset=".77913"/><stop style="stop-color:#d45500" offset="1"/></linearGradient>
    <radialGradient id="rg3" gradientUnits="userSpaceOnUse" cy="1340.9" cx="246.56" gradientTransform="matrix(1.8878 .25541 -.0052165 .038557 -89.545 409.35)" r="232.63" inkscape:collect="always"><stop style="stop-color:#ffffff" offset="0"/><stop style="stop-color:#ffffff;stop-opacity:0" offset="1"/></radialGradient>
    <radialGradient id="rg4" gradientUnits="userSpaceOnUse" cy="1362.4" cx="270.41" gradientTransform="matrix(1.0349 .14234 -.033092 .24059 142.06 145.36)" r="260.11" inkscape:collect="always"><stop style="stop-color:#ffffff" offset="0"/><stop style="stop-color:#ffffff;stop-opacity:0" offset="1"/></radialGradient>
    <linearGradient id="lg5" y2="1380.2" gradientUnits="userSpaceOnUse" x2="255.62" gradientTransform="matrix(.83187 -.22148 .22148 .83187 -133.17 -536.81)" y1="1352.3" x1="268.22" inkscape:collect="always"><stop style="stop-color:#b3b3b3" offset="0"/><stop style="stop-color:#cccccc;stop-opacity:0" offset="1"/></linearGradient>
    <linearGradient id="lg6" y2="1333" gradientUnits="userSpaceOnUse" x2="271.58" gradientTransform="matrix(.83187 -.22148 .22148 .83187 -133.17 -536.81)" y1="1378.3" x1="250.3" inkscape:collect="always"><stop style="stop-color:#999999" offset="0"/><stop style="stop-color:#cccccc" offset=".11175"/><stop style="stop-color:#cccccc" offset=".50358"/><stop style="stop-color:#cccccc" offset="1"/><stop style="stop-color:#666666" offset="1"/></linearGradient>
    <radialGradient id="rg5" xlink:href="#lg1" gradientUnits="userSpaceOnUse" cy="1247.3" cx="271.59" gradientTransform="matrix(.85803 .065808 -.037450 .48829 196.79 -169.28)" r="260.11" inkscape:collect="always"/>
    <linearGradient id="lg7" y2="1343.5" xlink:href="#lg1" gradientUnits="userSpaceOnUse" x2="299" gradientTransform="matrix(.83187 -.22148 .22148 .83187 -133.17 -536.81)" y1="1274.8" x1="333.36" inkscape:collect="always"/>
    <radialGradient id="rg6" gradientUnits="userSpaceOnUse" cy="887.61" cx="507.65" gradientTransform="matrix(.85933 .051238 -.066067 1.108 221.41 -887.88)" r="493.46" inkscape:collect="always"><stop style="stop-color:#ffffff" offset="0"/><stop style="stop-color:#ffffff;stop-opacity:0" offset="1"/></radialGradient>
    <linearGradient id="lg8" y2="1350.4" gradientUnits="userSpaceOnUse" x2="532.35" gradientTransform="matrix(.83187 -.22148 .22148 .83187 -133.17 -536.81)" y1="1445.4" x1="489.92" inkscape:collect="always"><stop style="stop-color:#999999" offset="0"/><stop style="stop-color:#cccccc" offset=".11175"/><stop style="stop-color:#808080" offset=".50358"/><stop style="stop-color:#cccccc" offset="1"/><stop style="stop-color:#666666" offset="1"/></linearGradient>
  </defs>
  <g transform="translate(0 -252.36)">
    <g>
      <path d="m286.77 360.01c-5.0013 0.02-8.4572 2.7247-12.156 9.3437-0.011 0.02-0.0202 0.043-0.0313 0.063-1.0428 1.4399-2.094 3.1236-3.1562 5.1874l-21.219 52.531 3.125 1.4375-2.625 4.5c-1.1234 2.6381-1.8185 4.9438-2.1874 6.9688-0.0644 0.3528-0.1122 0.6948-0.1563 1.0312-0.007 0.051-0.025 0.1055-0.0313 0.1562-0.0342 0.2795-0.0418 0.5442-0.0624 0.8126-0.0158 0.2028-0.0231 0.397-0.0313 0.5937-0.007 0.1784-0.03 0.3578-0.0313 0.5313-0.0005 0.073-0.0005 0.146 0 0.2187 0.001 0.165 0.0247 0.3394 0.0313 0.5 0.0241 0.5597 0.0699 1.1159 0.1563 1.625 0.007 0.043 0.0236 0.083 0.0312 0.125 0.019 0.1048 0.041 0.2098 0.0625 0.3125 0.0197 0.094 0.01 0.1892 0.0313 0.2812 0.0665 0.2835 0.1646 0.5444 0.25 0.8126 0.003 0.01-0.003 0.022 0 0.031 0.0735 0.2291 0.1634 0.4689 0.25 0.6875 0.3462 0.8707 0.7878 1.6493 1.3124 2.375 0.0605 0.084 0.1251 0.1679 0.1876 0.25 0.2325 0.3051 0.46 0.5911 0.7187 0.875 0.333 0.3677 0.6923 0.6938 1.0625 1.0313 0.2055 0.187 0.4099 0.3832 0.625 0.5624 0.5136 0.4281 1.0374 0.8254 1.5938 1.2188 0.1662 0.1176 0.3309 0.2284 0.5 0.3438 0.7081 0.4832 1.4507 0.9461 2.1874 1.4062 0.0959 0.06 0.1853 0.1278 0.2813 0.1875 0.1279 0.08 0.2469 0.1705 0.375 0.25 0.1234 0.077 0.2516 0.1421 0.375 0.2187 0.8389 0.5211 1.6608 1.0476 2.4687 1.5938l435 199.28c0.76555 0.3419 1.55 0.6679 2.3125 0.9688 0.69519 0.2754 1.3709 0.4972 2.0625 0.7188 0.12599 0.04 0.24916 0.087 0.375 0.125 0.22999 0.07 0.45803 0.1567 0.6875 0.2187 0.18757 0.05 0.37532 0.081 0.5625 0.125 0.22042 0.053 0.43638 0.1117 0.65625 0.1563 0.062 0.01 0.1256 0.02 0.1875 0.031 0.31564 0.06 0.62314 0.1153 0.9375 0.1562 0.0624 0.01 0.12517 0.024 0.1875 0.031 0.0829 0.01 0.16715-0.01 0.25 0 0.0626 0.01 0.12492 0.026 0.1875 0.031 0.60643 0.052 1.2118 0.068 1.8125 0.031 0.32795-0.021 0.64272-0.075 0.96875-0.125 0.0406-0.01 0.0845 0.01 0.125 0 0.0222 0 0.0403-0.027 0.0625-0.031 2.7221-0.4611 5.3686-1.9746 7.9062-5.2813 3.0418-4.3148 5.6004-8.6653 7.75-13.062l20.438 7.9062 27.25-12.094 162.41 69.594c-292.83 87.259-555.25 91.452-821.41 72.657-25.486-5.511-38.293 8.0455-36.781 26.375-0.3418 3.8037-0.008 7.9197 1.0624 12.188l28.563 78.562c6.0469 19.188 20.272 19.587 35.719 17.156 268.45-2.8314 550.91 0.7471 905.97-157.84 58.081 25.347 121.11 25.957 183.09 31.812l1.6875-3.625c0.1877 0.018 0.3747 0.045 0.5625 0.062l8.0938-17.188c-8.9195-1.2423-17.748-2.7262-26.5-4.4375-1.7504-0.3423-3.5059-0.6712-5.25-1.0312-41.22-8.5091-80.687-21.937-119.19-38.063 0.026-0.4116 0.07-0.8045 0.125-1.125l1.4063-25.719c0.1122-2.0208 0.1161-3.8968 0-5.6875 1.3787-24.817-15.34-32.075-28.562-27.156-19.205 7.144-38.259 13.894-57.188 20.312-26.771-13.504-53.362-27.554-80.031-41.344-210.37-101.03-422.58-209.45-625.28-279.81-5.0158-1.8486-8.9078-2.9504-12.156-2.9375z" style="opacity:0.78;filter:url(#f1);fill:#000000" transform="matrix(.83187 -.22148 .22148 .83187 -145.97 189.46)"/>
      <path d="m1047 540.48c-98.46 12.06-193.92-12.45-289.66-33.56-197.38-37.45-397.93-80.64-582.13-94.28-12.219-1.1383-16.611 0.38501-19.218 12.316l-6.0126 48.395 401.83 69.392 57.469 6.2963 20.004-16.125 242.48 35.329c58.507 12.827 115.27-2.1289 172.36-11.696z" style="fill:#4d4d4d"/>
      <path d="m1048.1 537.01c-98.47 12.06-193.93-12.44-289.68-33.55-197.37-37.46-397.92-80.64-582.13-94.28-12.219-1.1383-16.611 0.385-19.218 12.316l-6.0126 48.395 401.83 69.392 57.469 6.2962 20.004-16.125 242.48 35.329c58.507 12.827 115.27-2.1289 172.36-11.696z" style="fill:url(#lg8)"/>
      <path d="m1048.1 537.01c-98.47 12.06-193.93-12.44-289.68-33.55-197.37-37.46-397.92-80.64-582.13-94.28-12.219-1.1383-16.611 0.385-19.218 12.316l-6.0126 48.395 401.83 69.392 57.469 6.2962 20.004-16.125 242.48 35.329c58.507 12.827 115.27-2.1289 172.36-11.696z" style="fill:url(#rg6)"/>
      <path d="m155.19 436.75-4.1216 33.14 401.82 69.403 57.46 6.2765 19.203-15.497-4.4473-20.363c-152.9-36.89-307.89-66.79-469.91-72.96z" style="fill:url(#lg7)"/>
      <path d="m155.19 436.75-4.1216 33.14 0.26165 0.0417 3.894-31.381c162.02 6.1708 317.01 36.066 469.91 72.96l4.1169 18.809 0.29642-0.24595-4.4473-20.363c-152.9-36.89-307.89-66.79-469.91-72.96z" style="fill:url(#rg5)"/>
      <path d="m153.84 470.38-2.1258 7.8041c-2.2419 15.638 6.5744 16.053 13.856 18.582l406 69.431c6.2227 1.0029 12.16 1.1737 15.41-6.6361 2.0199-5.4684 3.3456-10.822 4.1531-16.083l-38.25-4.1808-399.04-68.917z" style="fill:url(#lg6)"/>
      <path d="m151.38 483.5c0.34827 10.454 7.8496 11.056 14.192 13.259l406 69.431c5.7005 0.91879 11.142 1.1065 14.517-4.8672l-434.71-77.82z" style="fill:url(#lg5)"/>
      <path d="m155.19 436.75-4.1216 33.14 401.82 69.403 57.46 6.2765 19.203-15.497-4.4473-20.363c-152.9-36.89-307.89-66.79-469.91-72.96z" style="fill:url(#rg4)"/>
      <path d="m151.38 483.5c0.34827 10.454 7.8496 11.056 14.192 13.259l406 69.431c5.7005 0.91879 11.142 1.1065 14.517-4.8672l-434.71-77.82z" style="fill:url(#rg3)"/>
      <path d="m113.84 801.97c-24.995 1.182-31.658 18.596-22.432 35.243l41.17 59.033c9.2799 14.622 21.196 11.794 33.507 6.3505 228.88-63.531 471.55-124.69 740.43-349.85 10.82-7.5329 6.5684-16.142 6.2659-19.485l-4.5069-21.707c-4.37-20.94-19.88-23.27-29.8-16.24-259.22 183.63-506.56 257.11-764.64 306.66z" style="fill:#2b1100"/>
      <path d="m112.57 797.22c-24.995 1.182-31.658 18.596-22.432 35.243l41.17 59.033c9.2799 14.622 21.196 11.794 33.507 6.3505 228.88-63.531 471.55-124.69 740.43-349.85 10.82-7.5329 6.5684-16.142 6.2659-19.485l-4.5069-21.707c-4.36-20.95-19.88-23.27-29.79-16.25-259.23 183.64-506.57 257.11-764.65 306.67z" style="fill:url(#lg4)"/>
      <path d="m882.18 515.03c-250.17 180.42-495.34 251.47-744.69 300.54-0.84618 0.1665-1.6926 0.3318-2.5386 0.49881-10.773 2.1264-20.726 11.082-12.467 22.933l1.3667 1.9609 23.511 33.733c3.0508 2.7522 8.2096 2.0542 11.367 1.2184 228.69-63.479 465.49-123 729.98-343.82-0.006-0.39304 0.003-0.90141 0.006-1.3378l-3.1148-15.065c-1.2855-1.0616-2.8403-1.0525-3.4211-0.65328z" style="fill:url(#lg3)"/>
      <path d="m813.17 1516a21.213 17.173 0 1 1 -42.426 0 21.213 17.173 0 1 1 42.426 0z" transform="matrix(.68507 -.18240 .18240 .68507 38.01 -349.68)" style="fill:#2b1100"/>
      <path d="m813.17 1516a21.213 17.173 0 1 1 -42.426 0 21.213 17.173 0 1 1 42.426 0z" transform="matrix(.61167 -.16286 .16286 .61167 125.77 -253.88)" style="fill:#000000"/>
      <path d="m813.17 1516a21.213 17.173 0 1 1 -42.426 0 21.213 17.173 0 1 1 42.426 0z" transform="matrix(.61167 -.16286 .16286 .61167 125.77 -253.88)" style="fill:url(#lg2)"/>
      <path d="m882.18 515.03c-250.17 180.42-495.34 251.47-744.69 300.54-0.84618 0.1665-1.6926 0.3318-2.5386 0.49881-10.773 2.1264-20.726 11.082-12.467 22.933l1.3667 1.9609 23.511 33.733c3.0508 2.7522 8.2096 2.0542 11.367 1.2184 228.69-63.479 465.49-123 729.98-343.82-0.006-0.39304 0.003-0.90141 0.006-1.3378l-3.1148-15.065c-1.2855-1.0616-2.8403-1.0525-3.4211-0.65328z" style="opacity:.39344;fill:url(#rg2)"/>
      <path d="m882.08 493.03c12.075-0.49432 12.237 5.3207 10.834 11.964-71.394 53.114-152.57 92.731-233.16 133.17 76.284-47.282 157.55-92.055 222.33-145.13z" style="opacity:0.34;fill:url(#rg1)"/>
    </g>
  </g>
</svg>`,
        child: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 128 128"><path fill="#543930" d="M28 15c-11.23 4.24-16 1-16 1c0 11 5 11 5 11S4 37.89 4 56c0 21 10.49 28.22 10.49 28.22c.54.56 1.41 1.83 1.41 1.83s.3 1.53.29 2.31C16.12 93.84 16 100 22 106s13.19 6.22 16 7c6.18 1.72 40.04 1.06 47.15.59c8.85-.59 16.28-3.57 22.14-9.43c7.44-7.44 4.29-17.48 4.69-18.57c.4-1.1 13.12-15.62 12.03-33.58c-2-33-26-32-26-32S92 4 68 4c-28 0-36.07 9.52-40 11"/><radialGradient id="SVGAK7Wxe9U" cx="628.717" cy="33.995" r="33.722" gradientTransform="matrix(-.8776 .4793 -.3113 -.57 643.7 -187.995)" gradientUnits="userSpaceOnUse"><stop offset=".728" stop-color="#6d4c41" stop-opacity="0"/><stop offset="1" stop-color="#6d4c41"/></radialGradient><path fill="url(#SVGAK7Wxe9U)" d="M64.03 114.11c11.02.06 21.72.25 25.1-.68c2.82-.78 11.05-2.42 17.84-8.95c5.12-4.93 6.23-11.84 4.57-17.96c-.18-.68-47.51 27.59-47.51 27.59"/><radialGradient id="SVGoK5EWcmG" cx="46.755" cy="34.369" r="34.005" gradientTransform="matrix(.8776 .4793 .3113 -.57 -4.974 90.808)" gradientUnits="userSpaceOnUse"><stop offset=".728" stop-color="#6d4c41" stop-opacity="0"/><stop offset="1" stop-color="#6d4c41"/></radialGradient><path fill="url(#SVGoK5EWcmG)" d="M64.03 114.11c-11.02.06-22.65-.17-26.03-1.11c-2.82-.78-10-1-16-7s-5.88-12.16-5.81-17.64c.01-.69-.22-1.95-.28-2.25L16 86z"/><radialGradient id="SVG1LCJXbLS" cx="26.619" cy="80.139" r="34.328" gradientTransform="matrix(.0746 -.9972 -.8311 -.0622 91.236 79.391)" gradientUnits="userSpaceOnUse"><stop offset=".699" stop-color="#6d4c41" stop-opacity="0"/><stop offset="1" stop-color="#6d4c41"/></radialGradient><path fill="url(#SVG1LCJXbLS)" d="M11.56 81.33S21.1 68.02 23.95 60.2c.58-1.58 2.44-22.49 1.55-25.16c-1.66-5.02-3.74-11.63-8.5-8.04C7.99 35.55 4.49 45.1 4.07 53.75c-.74 15.21 4.82 24.44 7.49 27.58"/><path fill="#99674f" d="M101.77 67.91H26.34c-8.13 0-14.79 6.4-14.79 14.23s6.65 14.23 14.79 14.23h75.43c8.13 0 14.79-6.4 14.79-14.23s-6.66-14.23-14.79-14.23"/><path fill="#ba8d68" d="M63.77 9.21c-23.86 0-45.96 25.07-45.96 61.14c0 35.88 22.77 53.62 45.96 53.62s45.96-17.74 45.96-53.62c0-36.07-22.1-61.14-45.96-61.14"/><path fill="#99674f" d="M68.89 87.13a1.6 1.6 0 0 0-.42-.11h-9.3c-.14.02-.28.05-.42.11c-.84.34-1.31 1.21-.91 2.14s2.25 3.54 5.98 3.54s5.58-2.61 5.98-3.54s-.07-1.8-.91-2.14"/><path fill="#613e31" d="M32.51 68.42s.17-.25.5-.67c.09-.1.16-.21.28-.34c.14-.14.31-.28.48-.44c.18-.15.37-.32.57-.5c.2-.17.41-.3.63-.46c.22-.15.45-.31.7-.46c.26-.14.52-.28.79-.42q.405-.225.87-.39c.3-.12.61-.24.93-.35c.65-.18 1.32-.38 2.02-.47c.7-.14 1.42-.15 2.14-.18c.72.04 1.44.05 2.14.18c.7.09 1.38.29 2.02.47c.32.11.63.23.93.35s.59.24.87.39c.27.14.54.29.79.42c.25.15.48.31.7.46c.22.16.43.29.62.45c.18.16.36.32.52.46c.16.15.31.28.44.41c.13.14.24.27.34.39c.4.47.61.75.61.75c.67.93.46 2.22-.47 2.88c-.56.41-1.26.49-1.88.28l-.38-.13s-.25-.09-.65-.26c-.1-.04-.2-.1-.32-.14c-.13-.04-.25-.09-.39-.14c-.27-.11-.58-.22-.92-.32c-.17-.05-.34-.12-.52-.17c-.19-.04-.37-.09-.57-.14c-.1-.03-.19-.05-.29-.08c-.1-.02-.2-.04-.31-.06c-.21-.03-.41-.09-.62-.13c-.43-.05-.86-.14-1.31-.16c-.45-.06-.9-.04-1.36-.07c-.46.03-.91.01-1.36.07c-.45.02-.88.11-1.31.16c-.21.04-.41.1-.62.13l-.31.06c-.1.03-.19.05-.29.08c-.19.05-.38.1-.57.14c-.18.05-.35.12-.52.17q-.255.075-.48.15c-.13.05-.26.09-.38.14c-.12.04-.24.08-.36.11c-.13.05-.27.13-.38.19c-.47.24-.75.36-.75.36c-1.08.45-2.33-.06-2.78-1.15a2.18 2.18 0 0 1 .21-2.02m60.04 3.16s-.28-.12-.75-.36c-.11-.06-.25-.14-.38-.19c-.12-.03-.23-.07-.36-.11c-.12-.04-.25-.09-.38-.14c-.15-.05-.32-.1-.48-.15c-.17-.05-.34-.12-.52-.17s-.37-.1-.57-.14c-.1-.03-.19-.05-.29-.08c-.1-.02-.2-.04-.31-.06c-.21-.03-.41-.09-.62-.13c-.43-.05-.86-.14-1.31-.16c-.45-.06-.9-.04-1.36-.07c-.46.03-.91.01-1.36.07c-.45.02-.88.11-1.31.16c-.21.04-.41.1-.62.13l-.31.06c-.1.03-.19.05-.29.08c-.19.05-.38.1-.57.14c-.18.05-.35.12-.52.17c-.34.1-.65.21-.92.32c-.14.05-.26.11-.39.14c-.12.05-.22.1-.32.14c-.39.18-.64.26-.64.26l-.37.13a2.06 2.06 0 0 1-2.63-1.27c-.23-.66-.1-1.36.27-1.89c0 0 .2-.28.61-.75c.1-.12.21-.25.34-.39c.13-.13.29-.26.44-.41c.16-.14.34-.3.52-.46c.19-.16.4-.29.62-.45c.22-.15.45-.31.7-.46c.26-.14.52-.28.79-.42c.27-.15.56-.28.86-.39c.3-.12.61-.24.93-.35c.65-.18 1.32-.38 2.02-.47c.7-.14 1.42-.15 2.14-.18c.72.04 1.44.04 2.14.18c.7.08 1.38.29 2.02.47c.32.11.63.23.93.35s.59.24.86.39c.27.14.54.29.79.42c.25.15.48.31.7.46c.22.16.43.29.63.46s.39.34.57.5c.17.16.34.3.48.44c.12.13.2.24.28.34c.33.41.5.67.5.67c.66.97.41 2.29-.56 2.95c-.6.43-1.37.48-2 .22"/><g fill="#49362e"><ellipse cx="41.96" cy="80.34" rx="6.48" ry="6.71"/><ellipse cx="85.68" cy="80.34" rx="6.48" ry="6.71"/></g><path fill="#5d4037" d="M75.01 97.97c-4.19 2.49-17.91 2.49-22.1 0c-2.4-1.43-4.86.76-3.86 2.94c.98 2.15 8.47 7.13 14.95 7.13s13.87-4.98 14.85-7.13c.99-2.19-1.43-4.37-3.84-2.94"/><path fill="#543930" d="M64 7C44.19 7 28.92 18.32 21.7 36.48c-2.9 7.29-5.26 15.05-5.26 22.89C16.44 73 19 85 19 85c7-9 5-18 5-18c9-12 35.82-21.64 36-22l-5.4 10.81c-.68 1.35.48 2.97 1.95 2.65C82 53 93.18 43.19 93.18 43.19S94 58 105 68c0 0 0 8 3 17c0 0 5-18 1.58-37.28c-2.25-12.66-9.52-24.83-20.04-32.67C82.15 9.54 73.15 7 64 7"/><radialGradient id="SVGJ1u1AbfL" cx="172.221" cy="61.128" r="46.468" gradientTransform="matrix(-.9378 -.3944 -.2182 .5285 236.462 66.99)" gradientUnits="userSpaceOnUse"><stop offset=".699" stop-color="#6d4c41" stop-opacity="0"/><stop offset="1" stop-color="#6d4c41"/></radialGradient><path fill="url(#SVGJ1u1AbfL)" d="M81.19 5.93c9.95 3.28 16.06 9.58 17.95 17.49c.56 2.32.15 23.66-41.22-.97c-15.39-9.16-11.18-14.9-9.38-15.55c7.04-2.53 19.81-5.2 32.65-.97"/><radialGradient id="SVG5cOXNAPO" cx="161.283" cy="92.173" r="48.129" gradientTransform="matrix(.5235 .852 .6321 -.3884 -48.207 -37.265)" gradientUnits="userSpaceOnUse"><stop offset=".699" stop-color="#6d4c41" stop-opacity="0"/><stop offset="1" stop-color="#6d4c41"/></radialGradient><path fill="url(#SVG5cOXNAPO)" d="M116.24 79.21s14.72-20.84 3.79-44.33C112.9 19.58 98.42 19.93 98 20c0 0 1.57 3.84 1.01 6.77c-.95 5-5.11 6.44-5.11 6.44c16.38 9.98 10.8 35.53 22.34 46"/><radialGradient id="SVGGYOyScSf" cx="183.604" cy="211.352" r="8.742" gradientTransform="matrix(.9968 .0796 .0943 -1.182 -185.896 247.333)" gradientUnits="userSpaceOnUse"><stop offset=".58" stop-color="#6d4c41"/><stop offset="1" stop-color="#6d4c41" stop-opacity="0"/></radialGradient><path fill="url(#SVGGYOyScSf)" d="M27.28 15.27c-10.55 3.77-15.23.81-15.26.73c-.32 1.23.37 8.7 6.9 6.37c2.81-1.02 8.33-6.75 8.36-7.1"/><radialGradient id="SVGX2CQ9X2q" cx="340.305" cy="96.032" r="7.22" gradientTransform="matrix(.6211 -.7838 -1.2436 -.9854 -70.425 384.055)" gradientUnits="userSpaceOnUse"><stop offset=".702" stop-color="#6d4c41" stop-opacity="0"/><stop offset="1" stop-color="#6d4c41"/></radialGradient><path fill="url(#SVGX2CQ9X2q)" d="M11.98 15.99c0 .01-.01.03-.01.06c-.03 1.17-.01 10.13 5.03 10.95l7.61-3.35c-9.49-.19-12.62-7.69-12.62-7.69s-.01.02-.01.03"/></svg>',
        star: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 128 128"><defs><path id="SVGY3tyEc8s" d="M86.63 36.54c-.82.19-1.65.38-2.48.53c-9.06 1.66-18.11 1.54-27.17 1.25c-4.44-.14-8.89-.45-13.21-1.25c-.85-.16-1.67-.33-2.49-.51l1.61 58.72c5.99 6.62 16.06 6.47 20.89 6.4c4.82.07 14.72-1.01 20.79-7.02z"/></defs><clipPath id="SVGrSq6veBp"><use href="#SVGY3tyEc8s"/></clipPath><path fill="#fff" d="M38.47 26.98h51.22v79.05H38.47z" clip-path="url(#SVGrSq6veBp)"/><path fill="#ed6c30" d="M60.41 35.4c-16.79 2.77-21.77 12.38-21.77 12.38l2.13 18.64s1.92-6.98 13.94-13.4c12.46-6.66 27.18-8.79 33.73-20.5z" clip-path="url(#SVGrSq6veBp)"/><path fill="#006ca2" d="M87.53 42.95c-1.57 7.45-8.14 13.4-13.92 16.04C63.2 63.75 57.83 66.28 53 69.41c-10.09 6.55-11.92 14.66-11.92 14.66v11.67l6.24 4.54s3.81-7.41 9.6-12.96c7.11-6.8 11.29-8.01 19.97-13.22c6.45-3.86 10.64-10.68 10.64-10.68z" clip-path="url(#SVGrSq6veBp)"/><path fill="#ed6c30" d="M62.13 104.69s3.62-6.19 8.03-10.31c8.46-7.91 13.18-6.92 17.1-17.87v18.5c0 .01-2.65 9.51-25.13 9.68" clip-path="url(#SVGrSq6veBp)"/><path fill="#78a3ad" d="M48.21 7.15c2.32-2.86 5.31-4.7 8.59-5.53c4.54-1.15 10.01-1.15 14.55 0c3.27.83 6.26 2.67 8.56 5.53c1.48 1.82 4.04 5.05 3.31 7.76c-.38 1.41-1.41 1.67-2.49 2.11c-2.64 1.06-5.42 1.59-8.23 1.83c-5.74.47-11.23.47-16.96 0c-2.8-.24-5.58-.78-8.21-1.83c-1.08-.44-2.1-.7-2.47-2.11c-.73-2.72 1.86-5.94 3.35-7.76m43 21.04c-2.39 1.2-4.93 2.07-7.66 2.6c-3.73.73-7.54 1.19-11.37 1.45c-5.35.36-10.99.37-16.43 0c-3.83-.26-7.63-.72-11.35-1.45c-2.74-.53-5.26-1.4-7.64-2.6c-2.3-1.16-3.38-3.3-2.12-5.53c.9-1.59 2.53-2.83 4.55-3.17c1.09-.2 5.43 4.25 24.5 4.25c19.44 0 24.06-4.45 25.17-4.25c2.02.35 3.64 1.58 4.53 3.17c1.22 2.23.13 4.37-2.18 5.53m-11.19 92.25c-2.32 3.04-5.32 5.01-8.62 5.89c-4.57 1.22-10.07 1.22-14.65 0c-3.29-.88-6.31-2.85-8.64-5.89c-.52-.68-1.18-1.57-1.79-2.54c2.35 1.35 4.94 2.36 7.71 2.9c6.25 1.22 13.77 1.22 20.03 0c2.79-.55 5.4-1.57 7.76-2.95c-.6 1-1.27 1.9-1.8 2.59m11.7-16.79c-.73 2.6-2.57 5.23-4.84 6.68c-2.58 1.65-5.31 3.03-8.23 3.9c-9.29 2.77-20.73 2.77-30.01 0c-2.91-.87-5.62-2.25-8.19-3.9c-2.26-1.46-4.09-4.09-4.79-6.68c-.36-1.32-.43-2.79.19-4.08c.49-1.05 1.67-2.61 2.99-2.17c.75.25 1.31 1.3 1.77 1.89c.69.89 1.47 1.68 2.37 2.39c1.81 1.43 3.94 2.45 6.15 3.19c8.63 2.89 20.43 2.9 29.1 0c2.22-.74 4.35-1.76 6.17-3.19c.91-.71 1.69-1.5 2.4-2.39c.46-.59 1.03-1.64 1.78-1.89c1.32-.44 2.48 1.12 2.97 2.17c.61 1.29.54 2.76.17 4.08"/></svg>`,
        barber: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 128 128"><defs><path id="SVGY3tyEc8s" d="M86.63 36.54c-.82.19-1.65.38-2.48.53c-9.06 1.66-18.11 1.54-27.17 1.25c-4.44-.14-8.89-.45-13.21-1.25c-.85-.16-1.67-.33-2.49-.51l1.61 58.72c5.99 6.62 16.06 6.47 20.89 6.4c4.82.07 14.72-1.01 20.79-7.02z"/></defs><clipPath id="SVGrSq6veBp"><use href="#SVGY3tyEc8s"/></clipPath><path fill="#fff" d="M38.47 26.98h51.22v79.05H38.47z" clip-path="url(#SVGrSq6veBp)"/><path fill="#ed6c30" d="M60.41 35.4c-16.79 2.77-21.77 12.38-21.77 12.38l2.13 18.64s1.92-6.98 13.94-13.4c12.46-6.66 27.18-8.79 33.73-20.5z" clip-path="url(#SVGrSq6veBp)"/><path fill="#006ca2" d="M87.53 42.95c-1.57 7.45-8.14 13.4-13.92 16.04C63.2 63.75 57.83 66.28 53 69.41c-10.09 6.55-11.92 14.66-11.92 14.66v11.67l6.24 4.54s3.81-7.41 9.6-12.96c7.11-6.8 11.29-8.01 19.97-13.22c6.45-3.86 10.64-10.68 10.64-10.68z" clip-path="url(#SVGrSq6veBp)"/><path fill="#ed6c30" d="M62.13 104.69s3.62-6.19 8.03-10.31c8.46-7.91 13.18-6.92 17.1-17.87v18.5c0 .01-2.65 9.51-25.13 9.68" clip-path="url(#SVGrSq6veBp)"/><path fill="#78a3ad" d="M48.21 7.15c2.32-2.86 5.31-4.7 8.59-5.53c4.54-1.15 10.01-1.15 14.55 0c3.27.83 6.26 2.67 8.56 5.53c1.48 1.82 4.04 5.05 3.31 7.76c-.38 1.41-1.41 1.67-2.49 2.11c-2.64 1.06-5.42 1.59-8.23 1.83c-5.74.47-11.23.47-16.96 0c-2.8-.24-5.58-.78-8.21-1.83c-1.08-.44-2.1-.7-2.47-2.11c-.73-2.72 1.86-5.94 3.35-7.76m43 21.04c-2.39 1.2-4.93 2.07-7.66 2.6c-3.73.73-7.54 1.19-11.37 1.45c-5.35.36-10.99.37-16.43 0c-3.83-.26-7.63-.72-11.35-1.45c-2.74-.53-5.26-1.4-7.64-2.6c-2.3-1.16-3.38-3.3-2.12-5.53c.9-1.59 2.53-2.83 4.55-3.17c1.09-.2 5.43 4.25 24.5 4.25c19.44 0 24.06-4.45 25.17-4.25c2.02.35 3.64 1.58 4.53 3.17c1.22 2.23.13 4.37-2.18 5.53m-11.19 92.25c-2.32 3.04-5.32 5.01-8.62 5.89c-4.57 1.22-10.07 1.22-14.65 0c-3.29-.88-6.31-2.85-8.64-5.89c-.52-.68-1.18-1.57-1.79-2.54c2.35 1.35 4.94 2.36 7.71 2.9c6.25 1.22 13.77 1.22 20.03 0c2.79-.55 5.4-1.57 7.76-2.95c-.6 1-1.27 1.9-1.8 2.59m11.7-16.79c-.73 2.6-2.57 5.23-4.84 6.68c-2.58 1.65-5.31 3.03-8.23 3.9c-9.29 2.77-20.73 2.77-30.01 0c-2.91-.87-5.62-2.25-8.19-3.9c-2.26-1.46-4.09-4.09-4.79-6.68c-.36-1.32-.43-2.79.19-4.08c.49-1.05 1.67-2.61 2.99-2.17c.75.25 1.31 1.3 1.77 1.89c.69.89 1.47 1.68 2.37 2.39c1.81 1.43 3.94 2.45 6.15 3.19c8.63 2.89 20.43 2.9 29.1 0c2.22-.74 4.35-1.76 6.17-3.19c.91-.71 1.69-1.5 2.4-2.39c.46-.59 1.03-1.64 1.78-1.89c1.32-.44 2.48 1.12 2.97 2.17c.61 1.29.54 2.76.17 4.08"/></svg>`,
    };

    const tbody = table.querySelector('tbody');

    currentServices.forEach((service, index) => {
        const tr = document.createElement('tr');

        const isFirst = index === 0;
        const isLast = index === currentServices.length - 1;

        tr.innerHTML = `
            <td style="text-align:center; vertical-align:middle;">
                <div style="display:flex; justify-content:center; align-items:center; height:100%;">${svgs[service.icon] || svgs.star}</div>
            </td>
            <td>${service.name}</td>
            <td>${service.price}</td>
             <td style="font-size:0.9em; color:#666;">${service.description || ''}</td>
            <td>
                    ${renderActionButtons(`editService(${index})`, `removeService(${index})`, {
            editLabel: `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#000000"><path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/></svg>`,
            extraHtml: `
                             <div style="display:flex; flex-direction:column; gap:2px; align-items:center;">
                                <img src="/images/arrow-up.svg" 
                                     onclick="moveServiceUp(${index})" 
                                     style="width:24px; height:24px; cursor:pointer; ${isFirst ? 'opacity:0.3; cursor:default;' : ''}"
                                     title="Monter">
                                <img src="/images/arrow-down.svg" 
                                     onclick="moveServiceDown(${index})" 
                                     style="width:24px; height:24px; cursor:pointer; ${isLast ? 'opacity:0.3; cursor:default;' : ''}"
                                     title="Descendre">
                             </div>
                        `
        })}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    container.appendChild(table);
}

// Global Edit/Delete/Add
let editingServiceIndex = -1;

export function addService() {
    const nameInput = document.getElementById('new-service-name');
    const priceInput = document.getElementById('new-service-price');
    const iconInput = document.getElementById('new-service-icon');
    const descInput = document.getElementById('new-service-desc');

    const name = nameInput.value;
    const price = priceInput.value;
    const icon = iconInput.value;
    const description = descInput.value;

    if (!name) return alert('Le nom de la prestation est requis');
    if (!price) return alert('Le prix est invalide (chiffres uniquement)');

    if (editingServiceIndex >= 0) {
        currentServices[editingServiceIndex] = { name, price, icon, description };
        resetServiceForm();
    } else {
        currentServices.push({ name, price, icon, description });
        resetServiceForm();
    }

    renderServicesList();
    saveServicesSettings(true);
}

function resetServiceForm() {
    editingServiceIndex = -1;
    document.getElementById('new-service-name').value = '';
    document.getElementById('new-service-price').value = '';
    document.getElementById('new-service-desc').value = '';
    document.getElementById('new-service-icon').value = 'cut';

    const formContainer = document.querySelector('#services-list + div');
    formContainer.querySelector('h5').textContent = 'Ajouter une prestation';
    document.getElementById('btn-add-service').textContent = 'Ajouter';
    document.getElementById('btn-cancel-service').style.display = 'none';
    formContainer.classList.remove('editing-mode');
}

export function cancelEditService() {
    resetServiceForm();
}

export function editService(index) {
    const svc = currentServices[index];
    document.getElementById('new-service-name').value = svc.name;
    document.getElementById('new-service-price').value = svc.price;
    document.getElementById('new-service-desc').value = svc.description || '';
    let iconVal = svc.icon || 'barber';
    if (iconVal === 'star') iconVal = 'barber';
    document.getElementById('new-service-icon').value = iconVal;

    editingServiceIndex = index;
    const formContainer = document.querySelector('#services-list + div');
    const formHeader = formContainer.querySelector('h5');
    formHeader.textContent = 'Modifier la prestation';
    formContainer.classList.add('editing-mode');
    formContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });

    document.getElementById('btn-add-service').textContent = 'Mettre à jour';
    document.getElementById('btn-cancel-service').style.display = 'block';
}

export function removeService(index) {
    if (!confirm('Supprimer cette prestation ?')) return;
    currentServices.splice(index, 1);

    // If editing this one, cancel edit
    if (editingServiceIndex === index) {
        resetServiceForm();
    }

    renderServicesList();
    saveServicesSettings(true);
}

export async function saveServicesSettings(silent = false) {
    const settings = {
        services: currentServices
    };

    try {
        const res = await fetch(`${API_URL}/settings`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(settings)
        });
        if (!res.ok) throw new Error('Network response was not ok');

        if (!silent) alert('Prestations enregistrées !');
    } catch (e) {
        console.error(e);
        alert('Erreur lors de la sauvegarde automatique. Vérifiez votre connexion.');
    }
}

// Global exposure
// Reordering
// Reordering with Animation
export function moveServiceUp(index) {
    if (index <= 0) return;

    const tbody = document.getElementById('services-tbody');
    const rows = tbody.querySelectorAll('tr');
    const currentRow = rows[index];
    const prevRow = rows[index - 1];

    // Add animation classes
    currentRow.classList.add('anim-row', 'z-over');
    prevRow.classList.add('anim-row', 'z-under');

    // Trigger reflow
    void currentRow.offsetWidth;

    // Apply transform
    currentRow.classList.add('slide-up');
    prevRow.classList.add('slide-down');

    // Wait for animation
    setTimeout(() => {
        const temp = currentServices[index];
        currentServices[index] = currentServices[index - 1];
        currentServices[index - 1] = temp;
        renderServicesList();
        saveServicesSettings(true);
    }, 400);
}

export function moveServiceDown(index) {
    if (index >= currentServices.length - 1) return;

    const tbody = document.getElementById('services-tbody');
    const rows = tbody.querySelectorAll('tr');
    const currentRow = rows[index];
    const nextRow = rows[index + 1];

    // Add animation classes
    currentRow.classList.add('anim-row', 'z-over');
    nextRow.classList.add('anim-row', 'z-under');

    // Trigger reflow
    void currentRow.offsetWidth;

    // Apply transform
    currentRow.classList.add('slide-down');
    nextRow.classList.add('slide-up');

    // Wait for animation
    setTimeout(() => {
        const temp = currentServices[index];
        currentServices[index] = currentServices[index + 1];
        currentServices[index + 1] = temp;
        renderServicesList();
        saveServicesSettings(true);
    }, 400);
}

// Global exposure
window.addService = addService;
window.editService = editService;
window.removeService = removeService;
window.cancelEditService = cancelEditService;
window.saveServicesSettings = saveServicesSettings;
window.moveServiceUp = moveServiceUp;
window.moveServiceDown = moveServiceDown;
