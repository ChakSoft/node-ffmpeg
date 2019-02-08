const fs = require('fs')
const path = require('path')
const errors = require('./errors')
const presets = require('./presets')
const utils = require('./utils')

const getSign = (val, inverse) => {
  return (inverse ? -val : val).toString()
}

const getMarginX = (left, right) => {
  return `${getSign(left, false)}${getSign(right, true)}`
}

const getMarginY = (top, bottom) => {
  return `${getSign(top, false)}${getSign(bottom, true)}`
}

const getMarginsFromSettings = (settings) => {
  return {
    x : getMarginX(settings.marginLeft, settings.marginRight),
    y : getMarginY(settings.marginTop, settings.marginBottom),
  }
}

const computeDimension = (metadata, options) => {
  const keepPixelAspectRatio = options.video.keepPixelAspectRatio || false
  const keepAspectRatio = options.video.keepAspectRatio || false

  let referrerResolution = metadata.video.resolution

  if (keepPixelAspectRatio) {
    if (utils.isEmptyObject(metadata.video.resolutionSquare)) {
      throw errors.renderError('resolution_square_not_defined')
    }
    referrerResolution = metadata.video.resolutionSquare
  }

  const aspect = {}
  let width
  let height

  const fixedWidth = /([0-9]+)x\?/.exec(options.video.size)
  const fixedHeight = /\?x([0-9]+)/.exec(options.video.size)
  const percentage = /([0-9]{1,2})%/.exec(options.video.size)
  const classicSize = /([0-9]+)x([0-9]+)/.exec(options.video.size)

  if (fixedWidth) {
    width = parseInt(fixedWidth[1], 10)
    if (!utils.isEmptyObject(metadata.video.aspect)) {
      height = Math.round(
        (width / metadata.video.aspect.x) * metadata.video.aspect.y
      )
    } else {
      height = Math.round(referrerResolution.h / (referrerResolution.w / width))
    }
  } else if (fixedHeight) {
    height = parseInt(fixedHeight[1], 10)
    if (!utils.isEmptyObject(metadata.video.aspect)) {
      width = Math.round(
        (height / metadata.video.aspect.y) * metadata.video.aspect.x
      )
    } else {
      width = Math.round(referrerResolution.w / (referrerResolution.h / height))
    }
  } else if (percentage) {
    const ratio = parseInt(percentage[1], 10) / 100
    width = Math.round(referrerResolution.w * ratio)
    height = Math.round(referrerResolution.h * ratio)
  } else if (classicSize) {
    width = parseInt(classicSize[1], 10)
    height = parseInt(classicSize[2], 10)
  } else {
    throw errors.renderError('size_format', options.video.size)
  }

  if (width % 2 !== 0) {
    width--
  }
  if (height % 2 !== 0) {
    height--
  }

  if (keepAspectRatio) {
    const gcdValue = utils.gcd(width, height)
    console.log('gcdValue', gcdValue)
    aspect.x = width / gcdValue
    aspect.y = height / gcdValue
    aspect.string = `${aspect.x}:${aspect.y}`

    console.log('ASPECT', aspect)
  }

  return {
    width,
    height,
    aspect,
  }
}

const marginHandler = {
  NE : (settings) => {
    const { x, y } = getMarginsFromSettings(settings)
    return `0${x}:0${y}`
  },
  NC : (settings) => {
    const { x, y } = getMarginsFromSettings(settings)
    return `main_w/2-overlay_w/2${x}:0${y}`
  },
  NW : (settings) => {
    const { x, y } = getMarginsFromSettings(settings)
    return `main_w-overlay_w${x}:0${y}`
  },
  SE : (settings) => {
    const { x, y } = getMarginsFromSettings(settings)
    return `0${x}:main_h-overlay_h${y}`
  },
  SC : (settings) => {
    const { x, y } = getMarginsFromSettings(settings)
    return `main_w/2-overlay_w/2${x}:main_h-overlay_h${y}`
  },
  SW : (settings) => {
    const { x, y } = getMarginsFromSettings(settings)
    return `main_w-overlay_w${x}:main_h-overlay_h${y}`
  },
  CE : (settings) => {
    const { x, y } = getMarginsFromSettings(settings)
    return `0${x}:main_h/2-overlay_h/2${y}`
  },
  C : (settings) => {
    const { x, y } = getMarginsFromSettings(settings)
    return `main_w/2-overlay_w/2${x}:main_h/2-overlay_h/2${y}`
  },
  CW : (settings) => {
    const { x, y } = getMarginsFromSettings(settings)
    return `main_w-overlay_w${x}:main_h/2-overlay_h/2${y}`
  },
}

class Video {
  constructor (filePath, settings, configuration, info) {
    this.filePath = filePath
    this.settings = settings
    this.configuration = configuration
    this.metadata = info

    this.commands = []
    this.inputs = [this.filePath]
    this.filtersComplex = []
    this.output = null
    this.options = {}
  }

  addCommand (command, argument) {
    if (this.commands.includes(command)) {
      throw errors.renderError('command_already_exists', command)
    }
    this.commands.push(command)
    if (argument) {
      this.commands.push(argument)
    }
  }

  addOption (container, name, value) {
    if (!this.options[container]) {
      this.options[container] = {}
    }
    this.options[container][name] = value
  }

  hasContainer (container) {
    return this.options[container] !== undefined
  }

  hasOption (container, name) {
    return (
      this.hasContainer(container) &&
      this.options[container][name] !== undefined
    )
  }

  getContainer (container) {
    if (!this.hasContainer(container)) {
      return null
    }
    return this.options[container]
  }

  getOption (container, name) {
    if (!this.hasOption(container, name)) {
      return null
    }
    return this.options[container][name]
  }

  addInput (argument) {
    this.inputs.push(argument)
  }

  addFilterComplex (argument) {
    this.filtersComplex.push(argument)
  }

  setOutput (path) {
    this.output = path
  }

  setDisableAudio () {
    this.addOption('audio', 'disabled', true)
    return this
  }

  setDisableVideo () {
    this.addOption('video', 'disabled', true)
    return this
  }

  setVideoFormat (format) {
    if (!this.configuration.encode.includes(format)) {
      throw errors.renderError('format_not_supported', format)
    }
    this.addOption('video', 'format', format)
    return this
  }

  setVideoCodec (codec) {
    if (!this.configuration.encode.includes(codec)) {
      throw errors.renderError('codec_not_supported', codec)
    }
    this.addOption('video', 'codec', codec)
    return this
  }

  setVideoBitRate (bitrate) {
    this.addOption('video', 'bitrate', bitrate)
    return this
  }

  setVideoFrameRate (framerate) {
    this.addOption('video', 'framerate', framerate)
    return this
  }

  setVideoStartTime (time) {
    this.addOption('video', 'startTime', utils.durationToSeconds(time))
    return this
  }

  setDuration (duration) {
    this.addOption('video', 'duration', utils.durationToSeconds(duration))
    return this
  }

  setVideoAspectRatio (ratio) {
    if (isNaN(ratio)) {
      const matching = /([0-9]+):([0-9]+)/.exec(ratio)
      if (matching) {
        ratio = parseFloat(matching[1] / matching[2])
      } else {
        ratio = this.metadata.video.aspect.value
      }
    }
    this.addOption('video', 'aspect', ratio)
    return this
  }

  setVideoSize (
    size,
    {
      keepPixelAspectRatio = true,
      keepAspectRatio = true,
      paddingColor = 'black',
    } = {}
  ) {
    this.addOption('video', 'size', size)
    this.addOption('video', 'keepPixelAspectRatio', keepPixelAspectRatio)
    this.addOption('video', 'keepAspectRatio', keepAspectRatio)
    this.addOption('video', 'paddingColor', paddingColor)
    return this
  }

  setAudioCodec (codec) {
    if (!this.configuration.encode.includes(codec)) {
      throw errors.renderError('codec_not_supported', codec)
    }
    if (codec === 'mp3' && this.configuration.modules.includes('libmp3lame')) {
      codec = 'libmp3lame'
    }
    this.addOption('audio', 'codec', codec)
    return this
  }

  setAudioFrequency (frequency) {
    this.addOption('audio', 'frequency', frequency)
    return this
  }

  setAudioChannels (channel) {
    if (!Object.keys(presets.audioChannel).includes(channel)) {
      throw errors.renderError('audio_channel_is_invalid', channel)
    }
    this.addOption('audio', 'channel', presets.audioChannel[channel])
    return this
  }

  setAudioBitRate (bitrate) {
    this.addOption('audio', 'bitrate', bitrate)
    return this
  }

  setAudioQuality (quality) {
    this.addOption('audio', 'quality', quality)
    return this
  }

  setWatermark (watermarkPath, options) {
    const wmOptions = {
      position : 'SW',
      marginTop : null,
      marginBottom : null,
      marginLeft : null,
      marginRight : null,
      ...options,
    }

    const cardinals = ['NE', 'NC', 'NW', 'SE', 'SC', 'SW', 'C', 'CE', 'CW']

    if (!fs.existsSync(watermarkPath)) {
      throw errors.renderError('invalid_watermark', watermarkPath)
    }
    if (!wmOptions.position || !cardinals.includes(wmOptions.position)) {
      throw errors.renderError('invalid_watermark_position', wmOptions.position)
    }

    wmOptions.marginTop =
      wmOptions.marginTop || isNaN(wmOptions.marginTop)
        ? wmOptions.marginTop
        : 0
    wmOptions.marginBottom =
      wmOptions.marginBottom || isNaN(wmOptions.marginBottom)
        ? wmOptions.marginBottom
        : 0
    wmOptions.marginLeft =
      wmOptions.marginLeft || isNaN(wmOptions.marginLeft)
        ? wmOptions.marginLeft
        : 0
    wmOptions.marginRight =
      wmOptions.marginRight || isNaN(wmOptions.marginRight)
        ? wmOptions.marginRight
        : 0

    if (!marginHandler[wmOptions.position]) {
      throw errors.renderError('invalid_watermark_position', wmOptions.position)
    }
    const overlay = marginHandler[wmOptions.position](wmOptions)

    if (!wmOptions.internal) {
      this.addOption('video', 'watermark', {
        path : watermarkPath,
        overlay,
      })
      return this
    }
    this.addInput(watermarkPath)
    this.addFilterComplex(`overlay=${overlay}`)
    return this
  }

  addComplexAspect ({ x, y, string, paddingColor }) {
    const paddingColorSuffix = paddingColor ? `:${paddingColor}` : ''
    this.addFilterComplex(
      `scale=iw*sar:ih, pad=max(iw\\,ih*(${x}/${y})):ow/(${x}/${y}):(ow-iw)/2:(oh-ih)/2${paddingColorSuffix}`
    )
    this.addCommand('-aspect', string)
  }

  async save (destination) {
    const video = this.getContainer('video')
    if (video) {
      if (video.disabled) {
        this.addCommand('-vn')
      } else {
        video.format && this.addCommand('-f', video.format)
        video.codec && this.addCommand('-vcodec', video.codec)
        video.bitrate &&
          this.addCommand('-b', `${parseInt(video.bitrate, 10)}kb`)
        video.framerate && this.addCommand('-r', parseInt(video.framerate, 10))
        video.startTime && this.addCommand('-ss', parseInt(video.startTime, 10))
        video.duration && this.addCommand('-t', parseInt(video.duration, 10))

        if (video.watermark) {
          this.addInput(video.watermark.path)
          this.addFilterComplex(`overlay=${video.watermark.overlay}`)
        }

        if (video.size) {
          console.log('OPTIONS', this.options)
          const dimension = computeDimension(this.metadata, this.options)
          console.log('DIMENSION', dimension)
          if (dimension.aspect) {
            const { x, y, string } = dimension.aspect
            const paddingColor = video.paddingColor || ''
            this.addComplexAspect({
              x,
              y,
              string,
              paddingColor,
            })
          }
          this.addCommand('-s', `${dimension.width}x${dimension.height}`)
        }
      }
    }

    const audio = this.getContainer('audio')
    if (audio) {
      if (audio.disabled) {
        this.addCommand('-an')
      } else {
        audio.codec && this.addCommand('-acodec', audio.codec)
        audio.frequency && this.addCommand('-ar', parseInt(audio.frequency, 10))
        audio.channel && this.addCommand('-ac', audio.channel)
        audio.quality && this.addCommand('-aq', audio.quality)
        audio.bitrate &&
          this.addCommand('-ab', `${parseInt(audio.bitrate, 10)}k`)
      }
    }

    this.setOutput(destination)

    await this.execCommand()
    return this.output
  }

  reset () {
    this.commands = []
    this.inputs = [this.filePath]
    this.output = null
    this.options = {}
  }

  async execCommand () {
    const finalCommands = [
      'ffmpeg -i',
      ...this.inputs.map(utils.addQuotes),
      ...this.commands,
    ]
    if (this.filtersComplex.length) {
      finalCommands.push(`-filter_complex "${this.filtersComplex.join(', ')}"`)
    }
    finalCommands.push(this.output)

    return await utils.exec(finalCommands, this.settings)
  }

  async extractAudioToMP3 (destination) {
    if (fs.existsSync(destination)) {
      fs.unlinkSync(destination)
    }
    const dir = path.dirname(destination)
    const outputFilename = path.basename(destination, path.extname(destination))
    const output = path.join(dir, outputFilename)

    this.reset()

    this.addCommand('-vn')
    this.addCommand('-ar', 44100)
    this.addCommand('-ac', 2)
    this.addCommand('-ab', 192)
    this.addCommand('-f', 'mp3')

    this.setOutput(output)

    await this.execCommand()

    return this.output
  }

  async extractFrameToJPG (folder, settings = {}) {
    const frameOptions = {
      startTime : null,
      durationTime : null,
      frameRate : null,
      size : null,
      number : null,
      everyFrames : null,
      everySeconds : null,
      everyPercentage : null,
      keepPixelAspectRatio : true,
      keepAspectRatio : true,
      paddingColor : 'black',
      fileName : null,
      ...settings,
    }

    if (frameOptions.startTime) {
      frameOptions.startTime = utils.durationToSeconds(
        frameOptions.startTime,
        null
      )
    }
    if (frameOptions.durationTime) {
      frameOptions.durationTime = utils.durationToSeconds(
        frameOptions.durationTime,
        null
      )
    }
    if (frameOptions.frameRate && isNaN(frameOptions.frameRate)) {
      frameOptions.frameRate = null
    }
    if (!frameOptions.size) {
      const { w, h } = this.metadata.video.resolution
      frameOptions.size = `${w}x${h}`
    }
    if (frameOptions.number && isNaN(frameOptions.number)) {
      frameOptions.number = null
    }

    let everyCheck = 0
    if (frameOptions.everyFrames && isNaN(frameOptions.everyFrames)) {
      frameOptions.everyFrames = null
      everyCheck++
    }
    if (frameOptions.everySeconds && isNaN(frameOptions.everySeconds)) {
      frameOptions.everySeconds = null
      everyCheck++
    }
    if (
      frameOptions.everyPercentage &&
      (isNaN(frameOptions.everyPercentage) ||
        frameOptions.everyPercentage > 100)
    ) {
      frameOptions.everyPercentage = null
      everyCheck++
    }

    if (everyCheck >= 2) {
      throw errors.renderError('extract_frame_invalid_everyN_options')
    }

    if (!frameOptions.fileName) {
      frameOptions.fileName = path.basename(
        this.filePath,
        path.extname(this.filePath)
      )
    } else {
      const exx = {
        '%t' : Date.now(),
        '%s' : frameOptions.size,
        '%x' : frameOptions.size.split(':')[0],
        '%y' : frameOptions.size.split(':')[1],
      }
      const keys = Object.keys(exx)
      for (const key of keys) {
        frameOptions.fileName = frameOptions.fileName.replace(
          new RegExp(key, 'g'),
          exx[key]
        )
      }
    }

    frameOptions.fileName = `${path.basename(
      frameOptions.fileName,
      path.extname(frameOptions.fileName)
    )}_%d.jpg`
    utils.mkdirp(folder, 0x0777)

    this.reset()

    if (frameOptions.startTime) {
      this.addCommand('-ss', frameOptions.startTime)
    }
    if (frameOptions.durationTime) {
      this.addCommand('-t', frameOptions.durationTime)
    }
    if (frameOptions.frameRate) {
      this.addCommand('-r', frameOptions.frameRate)
    }

    this.setVideoSize(frameOptions.size, {
      keepPixelAspectRatio : frameOptions.keepPixelAspectRatio,
      keepAspectRatio : frameOptions.keepAspectRatio,
      paddingColor : frameOptions.paddingColor,
    })

    const dimension = computeDimension(this.metadata, frameOptions)
    this.addCommand('-s', `${dimension.width}x${dimension.height}`)
    if (dimension.aspect) {
      this.addComplexAspect({
        ...dimension.aspect,
        paddingColor : frameOptions.paddingColor,
      })
    }

    if (frameOptions.number) {
      this.addCommand('-vframes', frameOptions.number)
    }
    if (frameOptions.everyFrames) {
      this.addCommand('-vsync', 0)
      this.addFilterComplex(`select=not(mod(n\\,${frameOptions.everyFrames}))`)
    }
    if (frameOptions.everySeconds) {
      this.addCommand('-vsync', 0)
      this.addFilterComplex(`select=not(mod(t\\,${frameOptions.everySeconds}))`)
    }
    if (frameOptions.everyPercentage) {
      this.addCommand('-vsync', 0)
      const every = parseInt(
        (this.metadata.duration.seconds / 100) * frameOptions.everyPercentage
      )
      this.addFilterComplex(`select=not(mod(t\\,${every}))`)
    }

    this.setOutput(`${folder}/${frameOptions.fileName}`)

    await this.execCommand()

    const patternRegexp = new RegExp(frameOptions.fileName.replace('%d', '\\d'))
    return fs.readdirSync(folder).filter((file) => patternRegexp.test(file))
  }

  async watermark (path, outputFilePath = null, wmOptions = {}) {
    this.reset()
    this.setWatermark(path, {
      ...wmOptions,
      internal : true,
    })

    outputFilePath =
      outputFilePath ||
      `${path.dirname(this.filePath)}/${path.basename(
        this.filePath,
        path.extname(this.filePath)
      )}_watermarked_${path.basename(path, path.extname(path))}${path.extname(
        this.filePath
      )}`
    this.setOutput(outputFilePath)
    this.addCommand('-strict')
    this.addCommand('-2')

    await this.execCommand()

    return outputFilePath
  }
}

module.exports = Video
