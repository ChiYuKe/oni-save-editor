import assert from 'node:assert/strict'
import { shineCameraForRect, shineCameraKey, shineViewportForCamera } from '../src/lib/oniShineCamera'
const rect = { x: 320, y: 640, width: 1280, height: 640, scale: 1 }
assert.deepEqual(shineCameraForRect(rect, 304), {x:30,y:274,orthoSize:10,aspect:2})
const moved = shineCameraForRect({...rect,x:352,y:672},304)
assert.equal(moved.x,31); assert.equal(moved.y,273)
assert.notEqual(shineCameraKey(moved),shineCameraKey(shineCameraForRect(rect,304)))
assert.equal(shineCameraForRect({...rect,width:640,height:320},304).orthoSize,5)
assert.equal(shineViewportForCamera(rect,736,304,32,2)!.cellSize,64)
assert.equal(shineViewportForCamera({...rect,width:23552,height:9728,scale:.05},736,304),undefined)
assert.equal(shineViewportForCamera({...rect,x:-100000},736,304),undefined)
console.log('PASS camera world coordinates, pan, zoom, physical pixel density and bounded overview work')
