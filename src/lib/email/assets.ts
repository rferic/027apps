import sharp from 'sharp'
import { promises as fs } from 'fs'
import path from 'path'

export async function svgFileToPngDataUri(filePath: string, width = 44, height = 44): Promise<string> {
  const svg = await fs.readFile(filePath, 'utf-8')
  const png = await sharp(Buffer.from(svg)).resize(width, height).png().toBuffer()
  return `data:image/png;base64,${png.toString('base64')}`
}

export async function svgStringToPngDataUri(svg: string, width = 44, height = 44): Promise<string> {
  const png = await sharp(Buffer.from(svg)).resize(width, height).png().toBuffer()
  return `data:image/png;base64,${png.toString('base64')}`
}
