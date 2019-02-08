# FFMpeg Node Binding

[FFmpeg](http://ffmpeg.org/) module for [Node](http://nodejs.org/). This library provides a set of functions and utilities to abstract commands-line usage of ffmpeg. To use this library requires that ffmpeg is already installed (including all necessary encoding libraries like libmp3lame or libx264)

You can install this module using [npm](http://github.com/isaacs/npm):

    npm install ffmpeg

## Notes

This package has been forked from the original project `node-ffmpeg` created by @damianociarla.
As it seems to be abandoned and not working any more with newer versions of ffmpeg, we decided to refactor the code to ECMAScript 2016 and make it work again.

## Usage

Here is an example of FFMpeg Node usage :

    const getFFMpeg = require('ffmpeg')
    getFFMpeg('/path/to/inputfile.avi')
    	.then((video) => {
    		return video
    			.setVideoSize('?x720')
    			.save('/path/to/outputfile.mp4')
    	})
    	.then(() => console.log('done'))
    	.catch((err) => console.error(err))

## The video object

Each time you create a new instance, this library provides a new object to retrieve the information of the video, the ffmpeg configuration and all methods to make the necessary conversions:

```js
const getFFMpeg = require('ffmpeg')
getFFMpeg('/path/to/input.avi').then(video => {
  console.log(video.configuration)
  console.log(video.metadata)
})
```

## Preset functions

The video object contains a set of functions that allow you to perform specific operations independent of the settings for the conversion. In all the functions you can use the approach with the callback function or with the promise object

### _video.fnExtractSoundToMP3 (destionationFileName, callback)_

This function extracts the audio stream of a video into an mp3 file

Params:

- **destionationFileName**: Full path of the new file:

  > /path/to/your_audio_file.mp3

- **callback**: _(optional)_ If specified at the end of the process it will return the path of the new audio file:
  > function (error, file)

Example:

```js
try {
  var process = new ffmpeg('/path/to/your_movie.avi')
  process.then(
    function(video) {
      // Callback mode
      video.fnExtractSoundToMP3('/path/to/your_audio_file.mp3', function(
        error,
        file
      ) {
        if (!error) console.log('Audio file: ' + file)
      })
    },
    function(err) {
      console.log('Error: ' + err)
    }
  )
} catch (e) {
  console.log(e.code)
  console.log(e.msg)
}
```

### _video.fnExtractFrameToJPG(destinationFolder, settings, callback)_

This function takes care of extracting one or more frames from the video that is being developed. At the end of the operation will return an array containing the list of extracted images

Params:

- **destinationFolder**: Destination folder for the frames generated:

  > /path/to/save_your_frames

- **settings**: _(optional)_ Settings to change the default settings:

```js
		{
			start_time				: null		// Start time to recording
		  , duration_time			: null		// Duration of recording
		  , frame_rate				: null		// Number of the frames to capture in one second
		  , size					: null		// Dimension each frame
		  , number					: null		// Total frame to capture
		  , every_n_frames			: null		// Frame to capture every N frames
		  , every_n_seconds			: null		// Frame to capture every N seconds
		  , every_n_percentage		: null		// Frame to capture every N percentage range
		  , keep_pixel_aspect_ratio	: true		// Mantain the original pixel video aspect ratio
		  , keep_aspect_ratio		: true		// Mantain the original aspect ratio
		  , padding_color			: 'black'	// Padding color
		  , file_name				: null		// File name
		}
```

- **callback**: _(optional)_ If specified at the end of the process will be returned list of paths of frames created:
  > function (error, files)

Example:

```js
try {
  var process = new ffmpeg('/path/to/your_movie.avi')
  process.then(
    function(video) {
      // Callback mode
      video.fnExtractFrameToJPG(
        '/path/to/save_your_frames',
        {
          frame_rate: 1,
          number: 5,
          file_name: 'my_frame_%t_%s',
        },
        function(error, files) {
          if (!error) console.log('Frames: ' + files)
        }
      )
    },
    function(err) {
      console.log('Error: ' + err)
    }
  )
} catch (e) {
  console.log(e.code)
  console.log(e.msg)
}
```

### _video.fnAddWatermark(watermarkPath, newFilepath, settings, callback)_

This function takes care of adding a watermark to the video that is being developed. You can specify the exact position in which position the image

Params:

- **watermarkPath**: The full path where the image is stored to add as watermark:

  > /path/to/retrieve/watermark_file.png

- **newFilepath**: _(optional)_ Name of the new video. If not specified will be created by the function:

  > /path/to/save/your_file_video.mp4

- **settings**: _(optional)_ Settings to change the default settings:

```js
		{
			position		: "SW"		// Position: NE NC NW SE SC SW C CE CW
		  , margin_nord		: null		// Margin nord
		  , margin_sud		: null		// Margin sud
		  , margin_east		: null		// Margin east
		  , margin_west		: null		// Margin west
		};
```

- **callback**: _(optional)_ If specified at the end of the process it will return the path of the new video containing the watermark:
  > function (error, files)

Example:

```js
try {
  var process = new ffmpeg('/path/to/your_movie.avi')
  process.then(
    function(video) {
      // Callback mode
      video.fnAddWatermark(
        '/path/to/retrieve/watermark_file.png',
        '/path/to/save/your_file_video.mp4',
        {
          position: 'SE',
        },
        function(error, file) {
          if (!error) console.log('New video file: ' + file)
        }
      )
    },
    function(err) {
      console.log('Error: ' + err)
    }
  )
} catch (e) {
  console.log(e.code)
  console.log(e.msg)
}
```

## Custom settings

In addition to the possibility of using the preset, this library provides a variety of settings with which you can modify to your liking settings for converting video

- **video.setDisableAudio()**: Disables audio encoding

- **video.setDisableVideo()**: Disables video encoding

- **video.setVideoFormat(format)**: Sets the new video format. Example:
  video.setVideoFormat('avi')

- **video.setVideoCodec(codec)**: Sets the new audio codec. Example:

      video.setVideoCodec('mpeg4')

- **video.setVideoBitRate(bitrate)**: Sets the video bitrate in kb. Example:

      video.setVideoBitRate(1024)

- **video.setVideoFrameRate(framerate)**: Sets the framerate of the video. Example:

      video.setVideoFrameRate(25)

- **video.setVideoStartTime(time)**: Sets the start time. You can specify the value in seconds or in date time format. Example:

```js
// Seconds
video.setVideoStartTime(13)

// Date time format
video.setVideoStartTime('00:00:13')
```

- **video.setVideoDuration(duration)**: Sets the duration. You can specify the value in seconds or in date time format. Example:

```js
// Seconds
video.setVideoDuration(100)

// Date time format
video.setVideoDuration('00:01:40')
```

- **video.setVideoAspectRatio(aspect)**: Sets the new aspetc ratio. You can specify the value with a number or with a string in the format 'xx:xx'. Example:

```js
// Value
video.setVideoAspectRatio(1.77)

// Format xx:xx
video.setVideoAspectRatio('16:9')
```

- **video.setVideoSize(size, keepPixelAspectRatio, keepAspectRatio, paddingColor)**: Set the size of the video. This library can handle automatic resizing of the video. You can also apply a padding automatically keeping the original aspect ratio

  The following size formats are allowed to be passed to _size_:

  > 640x480 _Fixed size (plain ffmpeg way)_

  > 50% _Percental resizing_

  > ?x480 _Fixed height, calculate width_

  > 640x? _Fixed width, calculate height_

  Example:

```js
// In this example, the video will be automatically resized to 640 pixels wide and will apply a padding white
video.setVideoSize('640x?', true, true, '#fff')

// In this example, the video will be resized to 640x480 pixel, and if the aspect ratio is different the video will be stretched
video.setVideoSize('640x480', true, false)
```

- **video.setAudioCodec(codec)**: Sets the new audio codec. Example:

      video.setAudioCodec('libfaac')

- **video.setAudioFrequency(frequency)**: Sets the audio sample frequency for audio outputs in kb. Example:

      video.setAudioFrequency(48)

- **video.setAudioChannels(channel)**: Sets the number of audio channels. Example:

      video.setAudioChannels(2)

- **video.setAudioBitRate(bitrate)**: Sets the audio bitrate in kb. Example:

      video.setAudioBitRate(128)

- **video.setAudioQuality(quality)**: Sets the audio quality. Example:

      video.setAudioQuality(128)

- **video.setWatermark(watermarkPath, settings)**: Sets the watermark. You must specify the path where the image is stored to be inserted as watermark

  The possible settings (the values ​​shown are the default):

  - **position : "SW"**

    Position: NE NC NW SE SC SW C CE CW

  - **margin_nord : null**

    Margin nord (specify in pixel)

  - **margin_sud : null**

    Margin sud (specify in pixel)

  - **margin_east : null**

    Margin east (specify in pixel)

  - **margin_west : null**

    Margin west (specify in pixel)

  Example:

      // In this example will be added the watermark at the bottom right of the video
      video.setWatermark('/path/to/retrieve/watermark_file.png')

## Add custom options

If the ffmpeg parameters are not present in the list of available function you can add it manually through the following function

**video.addCommand(command, argument)**

Example:

```js
// In this example will be changed the output to avi format
video.addCommand('-f', 'avi')
```

## Save the file

After setting the desired parameters have to start the conversion process. To do this you must call the function 'save'. This method takes as input the final destination of the file and optionally a callback function. If the function callback is not specified it's possible use the promise object.

**video.save(destionationFileName, callback)**

Example:

```js
try {
  var process = new ffmpeg('/path/to/your_movie.avi')
  process.then(
    function(video) {
      video
        .setVideoSize('640x?', true, true, '#fff')
        .setAudioCodec('libfaac')
        .setAudioChannels(2)
        .save('/path/to/save/your_movie.avi', function(error, file) {
          if (!error) console.log('Video file: ' + file)
        })
    },
    function(err) {
      console.log('Error: ' + err)
    }
  )
} catch (e) {
  console.log(e.code)
  console.log(e.msg)
}
```
