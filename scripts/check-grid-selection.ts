import assert from 'node:assert/strict'
import { gridSelectionRect } from '../src/lib/oniGridSelection'
assert.deepEqual(gridSelectionRect({start:{x:0,y:0},end:{x:0,y:0}},304,32,0,0),{x:0,y:9696,width:32,height:32})
assert.deepEqual(gridSelectionRect({start:{x:181,y:260},end:{x:181,y:260}},304,24,-160*24,-25*24),{x:504,y:432,width:24,height:24})
const reversed={start:{x:5,y:8},end:{x:3,y:4}}
assert.deepEqual(gridSelectionRect(reversed,10,16,40,-12),{x:88,y:4,width:48,height:80})
assert.deepEqual(gridSelectionRect({start:reversed.end,end:reversed.start},10,16,40,-12),gridSelectionRect(reversed,10,16,40,-12))
assert.deepEqual(gridSelectionRect({start:{x:2,y:9},end:{x:2,y:9}},10,7.5,-4,12),{x:11,y:12,width:7.5,height:7.5})
console.log('PASS cell outline: bottom/top origin, actual fixture alignment, inclusive/reversed regions, fractional zoom and camera pan')
