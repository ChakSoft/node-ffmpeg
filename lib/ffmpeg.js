const fs = require('fs')
const errors = require('./errors')
const utils = require('./utils')
const configs = require('./configs')
const video = require('./video')

const getInfoConfiguration = async (settings) => {
  const format = {
    modules : [],
    encode : [],
    decode : [],
  }
  const { stdout } = await utils.exec(['ffmpeg', '-formats'], settings)
  const configuration = /configuration:(.*)/.exec(stdout)
  if (configuration) {
    format.modules = configuration[0]
      .match(/--enable-([a-zA-Z0-9\-]+)/g)
      .map((enable) => enable.replace(/--enable-/g, ''))
  }
  const codecList = stdout.match(/ (DE|D|E) (.*) {1,} (.*)/g)
  for (const codec of codecList) {
    const matching = / (DE|D|E) (.*) {1,} (.*)/.exec(codec)
    if (matching) {
      const scope = matching[1].trim()
      const extension = matching[2].trim()
      if (['D', 'DE'].includes(scope)) {
        format.decode.push(extension)
      }
      if (['E', 'DE'].includes(scope)) {
        format.encode.push(extension)
      }
    }
  }
  return format
}

const getVideoInfo = async (fileInput, settings) => {
  const { stdout } = await utils.exec(
    ['ffprobe', utils.addQuotes(fileInput)],
    settings
  )
  const filename = /from \'(.*)\'/.exec(stdout) || []
  const title = /(INAM|title)\s+:\s(.+)/.exec(stdout) || []
  const artist = /artist\s+:\s(.+)/.exec(stdout) || []
  const album = /album\s+:\s(.+)/.exec(stdout) || []
  const track = /track\s+:\s(.+)/.exec(stdout) || []
  const date = /date\s+:\s(.+)/.exec(stdout) || []
  const isSynced = /start: 0.000000/.exec(stdout) !== null
  const duration =
    /Duration: (([0-9]+):([0-9]{2}):([0-9]{2}).([0-9]+))/.exec(stdout) || []
  const container = /Input #0, ([a-zA-Z0-9]+),/.exec(stdout) || []
  const video_bitrate = /bitrate: ([0-9]+) kb\/s/.exec(stdout) || []
  const video_stream =
    /Stream #([0-9\.]+)([a-z0-9\(\)\[\]]*)[:] Video/.exec(stdout) || []
  const video_codec = /Video: ([\w]+)/.exec(stdout) || []
  const resolution = /(([0-9]{2,5})x([0-9]{2,5}))/.exec(stdout) || []
  const pixel = /[SP]AR ([0-9\:]+)/.exec(stdout) || []
  const aspect = /DAR ([0-9\:]+)/.exec(stdout) || []
  const fps = /([0-9\.]+) (fps|tb\(r\))/.exec(stdout) || []
  const audio_stream =
    /Stream #([0-9\.]+)([a-z0-9\(\)\[\]]*)[:] Audio/.exec(stdout) || []
  const audio_codec = /Audio: ([\w]+)/.exec(stdout) || []
  const sample_rate = /([0-9]+) Hz/i.exec(stdout) || []
  const channels = /Audio:.* (stereo|mono)/.exec(stdout) || []
  const audio_bitrate = /Audio:.* ([0-9]+) kb\/s/.exec(stdout) || []
  const rotate = /rotate[\s]+:[\s]([\d]{2,3})/.exec(stdout) || []

  const result = {
    filename : filename[1] || '',
    title : title[2] || '',
    artist : artist[1] || '',
    album : album[1] || '',
    track : track[1] || '',
    date : date[1] || '',
    synched : isSynced,
    duration : {
      raw : duration[1] || '',
      seconds : duration[1] ? utils.durationToSeconds(duration[1]) : 0,
    },
    video : {
      container : container[1] || '',
      bitrate : video_bitrate.length > 1 ? parseInt(video_bitrate[1], 10) : 0,
      stream : video_stream.length > 1 ? parseFloat(video_stream[1]) : 0.0,
      codec : video_codec[1] || '',
      resolution : {
        w : resolution.length > 2 ? parseInt(resolution[2], 10) : 0,
        h : resolution.length > 3 ? parseInt(resolution[3], 10) : 0,
      },
      resolutionSquare : {},
      aspect : {},
      rotate : rotate.length > 1 ? parseInt(rotate[1], 10) : 0,
      fps : fps.length > 1 ? parseFloat(fps[1]) : 0.0,
    },
    audio : {
      codec : audio_codec[1] || '',
      bitrate : audio_bitrate[1] || '',
      sample_rate : sample_rate.length > 1 ? parseInt(sample_rate[1], 10) : 0,
      stream : audio_stream.length > 1 ? parseFloat(audio_stream[1]) : 0.0,
      channels : {
        raw : channels[1] || '',
        value :
          channels.length > 0 ? { stereo : 2, mono : 1 }[channels[1]] || 0 : '',
      },
    },
  }
  // Check if exist aspect ratio
  if (aspect.length > 0) {
    let aspectValue = aspect[1].split(':')
    result.video.aspect.x = parseInt(aspectValue[0], 10)
    result.video.aspect.y = parseInt(aspectValue[1], 10)
    result.video.aspect.string = aspect[1]
    result.video.aspect.value = parseFloat(
      result.video.aspect.x / result.video.aspect.y
    )
  } else if (result.video.resolution.w > 0) {
    let gcdValue = utils.gcd(
      result.video.resolution.w,
      result.video.resolution.h
    )
    // Calculate aspect ratio
    result.video.aspect.x = result.video.resolution.w / gcdValue
    result.video.aspect.y = result.video.resolution.h / gcdValue
    result.video.aspect.string =
      result.video.aspect.x + ':' + result.video.aspect.y
    result.video.aspect.value = parseFloat(
      result.video.aspect.x / result.video.aspect.y
    )
  }

  // Save pixel ratio for output size calculation
  if (pixel.length > 0) {
    let pixelValue = pixel[1].split(':')
    result.video.pixelString = pixel[1]
    result.video.pixel = parseFloat(
      parseInt(pixelValue[0], 10) / parseInt(pixelValue[1], 10)
    )
  } else if (result.video.resolution.w !== 0) {
    result.video.pixelString = '1:1'
    result.video.pixel = 1
  } else {
    result.video.pixelString = ''
    result.video.pixel = 0.0
  }
  // Correct video.resolution when pixel aspectratio is not 1
  if (result.video.pixel !== 1 || result.video.pixel !== 0) {
    if (result.video.pixel > 1) {
      result.video.resolutionSquare.w = parseInt(
        result.video.resolution.w * result.video.pixel,
        10
      )
      result.video.resolutionSquare.h = result.video.resolution.h
    } else {
      result.video.resolutionSquare.w = result.video.resolution.w
      result.video.resolutionSquare.h = parseInt(
        result.video.resolution.h / result.video.pixel,
        10
      )
    }
  }

  return result
}

const getInformation = async (fileInput, settings) => {
  return await Promise.all([
    getInfoConfiguration(settings),
    getVideoInfo(fileInput, settings),
  ])
}

module.exports = async (inputFilepath, settings) => {
  if (!inputFilepath) {
    throw errors.renderError('empty_input_filepath')
  }
  if (typeof inputFilepath !== 'string') {
    throw errors.renderError('input_filepath_must_be_string')
  }
  if (!fs.existsSync(inputFilepath)) {
    throw errors.renderError('fileinput_not_exist')
  }

  const options = {
    ...configs,
    ...settings,
  }

  const [configuration, videoInfo] = await getInformation(
    inputFilepath,
    options
  )
  return new video(inputFilepath, options, configuration, videoInfo)
}
