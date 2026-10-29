import {readFile,readdir,lstat} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=path.resolve(import.meta.dirname,'..');
const hosting=JSON.parse(await readFile(path.join(root,'.openai/hosting.json'),'utf8'));
assert.equal(hosting.project_id,undefined,'Эталонный комплект не должен содержать личный project_id');
const manifest=JSON.parse(await readFile(path.join(root,'plugins/gr-nord/plugin.json'),'utf8'));
assert.equal(manifest.name,'gr-nord');
assert.equal(manifest.extensions['com.openai'].interface.displayName,'ГР - НОРД');
const catalog=JSON.parse(await readFile(path.join(root,'.agents/plugins/marketplace.json'),'utf8'));
assert.equal(catalog.plugins[0].source.path,'./plugins/gr-nord');
const skipped=new Set(['.git','node_modules','outputs','work','dist','.next','.vinext','.wrangler','.sites-runtime']);
let count=0;
async function visit(directory) {
  for(const item of await readdir(directory,{withFileTypes:true})) {
    if(skipped.has(item.name))continue;
    const filename=path.join(directory,item.name);
    assert.equal((await lstat(filename)).isSymbolicLink(),false,'Символьная ссылка в комплекте: '+filename);
    if(item.isDirectory()){await visit(filename);continue;}
    assert.ok(!/^\.env|^\.dev\.vars|\.pem$/.test(item.name),'Секретный файл в комплекте');
    count++;
    if(/\.(png|jpg|jpeg|webp|ttf|woff2?)$/i.test(item.name))continue;
    const content=await readFile(filename,'utf8');
    assert.ok(!/(?:appgprj_|appgdep_|plugin_asdk_app_|libfile_)[a-z0-9]{16,}/i.test(content),'Личная привязка в '+path.relative(root,filename));
    assert.ok(!/gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,}/.test(content),'Токен в '+path.relative(root,filename));
  }
}
await visit(root);
console.log('Чистый установочный комплект проверен: '+count+' файлов, без личного Site и токенов.');
