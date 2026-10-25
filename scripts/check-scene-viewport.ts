import assert from 'node:assert/strict'
import { sceneViewportForCamera } from '../src/lib/oniSceneViewport'
import { fluidViewportForCamera } from '../src/lib/oniFluidViewport'
const rect={x:65*32,y:149*32,width:640,height:480,scale:1.5}
const normal=sceneViewportForCamera(rect,736,304,32,1)!
assert.equal(normal.cellSize,48)
const retina=sceneViewportForCamera(rect,736,304,32,2)!
assert.equal(retina.cellSize,96)
assert.ok(retina.x*32<=rect.x && retina.right*32>=rect.x+rect.width)
assert.ok(retina.row*32<=rect.y && retina.bottom*32>=rect.y+rect.height)
assert.ok((retina.right-retina.x)*(retina.bottom-retina.row)<736*304/20)
assert.ok(retina.cellSize*retina.tile<=3072)
const adjacent=sceneViewportForCamera({...rect,x:rect.x+1},736,304,32,2)!
assert.equal(adjacent.key,retina.key,'sub-cell pan retains raster tiles')
const moved=sceneViewportForCamera({...rect,x:rect.x+1024},736,304,32,2)!
assert.notEqual(moved.key,retina.key)
assert.equal(sceneViewportForCamera({...rect,x:999999},736,304,32,2),undefined)
assert.equal(sceneViewportForCamera({...rect,scale:0},736,304,32,2),undefined)
const fluid=fluidViewportForCamera(rect,736,304,32,1)!
assert.equal(fluid.cellSize,48,'water composite must preserve building detail at this zoom')
const dense=fluidViewportForCamera({...rect,scale:4},736,304,32,2)!
assert.ok(dense.cellSize<=64 && dense.widthCells*dense.cellSize<=2048 && dense.heightCells*dense.cellSize<=1536)
console.log('PASS scene quality: zoom/DPI raster density, stable tile coordinates, viewport culling, capped texture sizes, invalid cameras, water detail budget')
