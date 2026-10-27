import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {parseSave,buildSave} from '../src/lib/save'
import {duplicantRows} from '../src/lib/oniDuplicants'
const save=parseSave(new Uint8Array(readFileSync(process.argv[2])))
const digest=()=>createHash('sha256').update(buildSave(save)).digest('hex'),before=digest()
const rows=duplicantRows(save)
const known=(save.manager?.groups??[]).filter(g=>g.tag==='Minion'||g.tag==='BionicMinion')
assert.equal(rows.length,known.reduce((sum,g)=>sum+g.instances.length,0))
assert.equal(new Set(rows.map(row=>row.key)).size,rows.length,'group-local indices must not collide')
for(const row of rows){
 assert.equal(row.instance,save.manager?.groups.find(g=>g.tag===row.tag)?.instances[row.index],'object detail link retains original group and index')
 assert.equal(row.model,row.tag==='BionicMinion'?'bionic':'organic')
 assert.ok(row.name)
}
assert.equal(before,digest(),'reading population leaves save bytes unchanged')
const proxy=save.manager?.groups.find(g=>g.tag==='MinionAssignablesProxy')
if(proxy)assert.ok(!rows.some(row=>proxy.instances.includes(row.instance)),'assignment proxies are not additional colonists')
const organic=rows.filter(row=>row.model==='organic').length,bionic=rows.length-organic
console.log(`PASS population ${rows.length} = organic ${organic} + bionic ${bionic}; original indices, no proxies and read-only bytes`)

if(save.manager)for(const tag of ['Minion','BionicMinion']){
 const groups=known.filter(group=>group.tag===tag)
 const only=duplicantRows({...save,manager:{...save.manager,groups}})
 assert.equal(only.length,groups.reduce((sum,group)=>sum+group.instances.length,0),`single-model saves: ${tag}`)
}
assert.deepEqual(duplicantRows({...save,manager:undefined}),[])
console.log('PASS single-model and missing-manager saves')
