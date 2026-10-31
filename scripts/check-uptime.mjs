import { pathToFileURL } from 'node:url';

export async function checkSite(baseUrl, fetcher = fetch) {
  const root = new URL(baseUrl);
  if (root.protocol !== 'https:' && root.hostname !== '127.0.0.1' && root.hostname !== 'localhost') throw new Error('Monitoring requires HTTPS.');
  const checks = [
    ['/', 'text/html', 'Kristijan Lenković'],
    ['/privacy/', 'text/html', 'Privacy'],
    ['/favicon.svg', 'image/svg+xml', '<svg'],
    ['/sitemap.xml', 'xml', 'https://kristijan.lenkovic.com/'],
  ];
  for (const [path, contentType, marker] of checks) {
    const url = new URL(path, root);
    const response = await fetcher(url, { signal: AbortSignal.timeout(10000), redirect: 'follow', headers: { 'User-Agent': 'KristijanWebsite-Uptime/1.0' } });
    if (response.status !== 200) throw new Error(`${path}: HTTP ${response.status}`);
    if (response.url && new URL(response.url).origin !== root.origin) throw new Error(`${path}: redirected to an unexpected origin`);
    if (!response.headers.get('content-type')?.includes(contentType)) throw new Error(`${path}: unexpected content type`);
    if (!(await response.text()).includes(marker)) throw new Error(`${path}: expected page content missing`);
  }
  return checks.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let healthy = false;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const count = await checkSite(process.env.SITE_URL || 'https://kristijan.lenkovic.com');
      console.log(`${count} HTTPS/content checks passed.`);
      healthy = true;
      break;
    } catch (error) {
      console.error(`Attempt ${attempt}: ${error.message}`);
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  if (!healthy) process.exitCode = 1;
}
