import { memo, useMemo } from 'react'

import Text from '@/components/common/Text'

const parseRgb = (color: string) => {
  const match = /rgba?\(([^)]+)\)/.exec(color)
  if (!match) return null
  const parts = match[1].split(',').map(item => item.trim())
  if (parts.length < 3) return null
  return {
    r: parseFloat(parts[0]),
    g: parseFloat(parts[1]),
    b: parseFloat(parts[2]),
    a: parts[3] == null ? 1 : parseFloat(parts[3]),
  }
}

const mix = (a: number, b: number, p: number) => Math.round(a + (b - a) * p)

// 逐字进度时仅对“边界字”做一次数值混合（不再整行逐字正则解析）
const blendColor = (
  from: { r: number, g: number, b: number, a: number },
  to: { r: number, g: number, b: number, a: number },
  progress: number,
) => `rgba(${mix(from.r, to.r, progress)}, ${mix(from.g, to.g, progress)}, ${mix(from.b, to.b, progress)}, ${(from.a + (to.a - from.a) * progress).toFixed(2)})`

// 本行只渲染为固定少量分段节点：已唱段 + 当前边界字(逐 tick 变色) + 未唱段，
// 逐字进度时不再每 tick 重建整行的每个词/每个字，把元素数从 ~30+ 降到 ~3。
export default memo(({
  words,
  activeWordIndex,
  activeWordProgress,
  size,
  playedColor,
  inactiveColor,
}: {
  words: { text: string }[]
  activeWordIndex: number
  activeWordProgress: number
  size: number
  playedColor: string
  inactiveColor: string
}) => {
  // 两端颜色每渲染只解析一次
  const rgb = useMemo(() => ({
    played: parseRgb(playedColor),
    inactive: parseRgb(inactiveColor),
  }), [playedColor, inactiveColor])

  const segments = useMemo(() => {
    const playedParts: string[] = []
    const inactiveParts: string[] = []
    // 无歌词词段、或尚未进入本行：整行按“未唱”色
    if (!words.length || activeWordIndex < 0) {
      const inactiveText = words.map(w => w.text).join('')
      return { playedText: '', activeChar: null, activeCharColor: inactiveColor, inactiveText }
    }
    for (let i = 0; i < words.length; i++) {
      if (i < activeWordIndex) playedParts.push(words[i].text)
      else if (i > activeWordIndex) inactiveParts.push(words[i].text)
    }

    const chars = Array.from(words[activeWordIndex].text)
    if (chars.length) {
      const exact = chars.length * Math.max(0, Math.min(activeWordProgress, 1))
      const playedCount = Math.floor(exact)
      const currentProgress = exact - playedCount
      playedParts.push(chars.slice(0, playedCount).join(''))
      if (playedCount < chars.length) {
        // 当前词未唱完：抽出边界字与剩余部分，仅边界字随字内进度由未唱色混入已唱色
        const boundary = chars[playedCount]
        inactiveParts.unshift(chars.slice(playedCount + 1).join(''))
        const activeCharColor = (rgb.played && rgb.inactive)
          ? blendColor(rgb.inactive, rgb.played, currentProgress)
          : (currentProgress >= 0.5 ? playedColor : inactiveColor)
        return {
          playedText: playedParts.join(''),
          activeChar: boundary,
          activeCharColor,
          inactiveText: inactiveParts.join(''),
        }
      }
    }
    // 当前词也已整词唱完：无边界字，剩余全进未唱段（此时为空）
    return {
      playedText: playedParts.join(''),
      activeChar: null,
      activeCharColor: inactiveColor,
      inactiveText: inactiveParts.join(''),
    }
  }, [words, activeWordIndex, activeWordProgress, playedColor, inactiveColor, rgb])

  return (
    <>
      {segments.playedText ? <Text key="played" size={size} color={playedColor}>{segments.playedText}</Text> : null}
      {segments.activeChar != null ? <Text key="active" size={size} color={segments.activeCharColor}>{segments.activeChar}</Text> : null}
      {segments.inactiveText ? <Text key="inactive" size={size} color={inactiveColor}>{segments.inactiveText}</Text> : null}
    </>
  )
})
