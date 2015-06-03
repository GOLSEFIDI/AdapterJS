(function () {

  'use strict';

  var baseGetUserMedia = null;

  if (window.navigator.mozGetUserMedia) {
    baseGetUserMedia = window.navigator.getUserMedia;

    window.navigator.getUserMedia = function (constraints, successCb, failureCb) {

      if (constraints && constraints.video && !!constraints.video.mediaSource) {
        // intercepting screensharing requests

        var updatedConstraints = JSON.parse(JSON.stringify(constraints));

        //constraints.video.mediaSource = constraints.video.mediaSource;
        updatedConstraints.video.mozMediaSource = updatedConstraints.video.mediaSource;

        baseGetUserMedia(updatedConstraints, successCb, function (error) {
          if (error.name === 'PermissionDeniedError' && window.parent.location.protocol === 'https:') {
            window.location.href = 'http://skylink.io/screensharing/ff_addon.php?domain=' + window.location.hostname;
          } else {
            failureCb(error);
          }
        })

      } else { // regular GetUserMediaRequest
        baseGetUserMedia(constraints, successCb, failureCb);
      }
    };

    window.getUserMedia = window.navigator.getUserMedia;

  } else if (window.navigator.webkitGetUserMedia) {
    baseGetUserMedia = window.navigator.getUserMedia;

    window.navigator.getUserMedia = function (constraints, successCb, failureCb) {

      if (constraints && constraints.video && !!constraints.video.mediaSource) {
        if (window.webrtcDetectedBrowser !== 'chrome') {
          throw new Error('Current browser does not support screensharing');
        }

        // would be fine since no methods
        var updatedConstraints = JSON.parse(JSON.stringify(constraints));

        var chromeCallback = function(error, sourceId) {
          if(!error) {
            updatedConstraints.video.mandatory = updatedConstraints.video.mandatory || {};
            updatedConstraints.video.mandatory.chromeMediaSource = 'desktop';
            updatedConstraints.video.mandatory.maxWidth = window.screen.width > 1920 ? window.screen.width : 1920;
            updatedConstraints.video.mandatory.maxHeight = window.screen.height > 1080 ? window.screen.height : 1080;

            if (sourceId) {
              updatedConstraints.video.mandatory.chromeMediaSourceId = sourceId;
            }

            delete updatedConstraints.video.mediaSource;

            baseGetUserMedia(updatedConstraints, successCb, failureCb);

          } else {
            if (error === 'permission-denied') {
              throw new Error('Permission denied for screen retrieval');
            } else {
              throw new Error('Failed retrieving selected screen');
            }
          }
        };

        var onIFrameCallback = function (event) {
          if (!event.data) {
            return;
          }

          if (event.data.chromeMediaSourceId) {
            if (event.data.chromeMediaSourceId === 'PermissionDeniedError') {
                chromeCallback('permission-denied');
            } else {
              chromeCallback(null, event.data.chromeMediaSourceId);
            }
          }

          if (event.data.chromeExtensionStatus) {
            chromeCallback(event.data.chromeExtensionStatus, null);
          }

          // this event listener is no more needed
          window.removeEventListener('message', onIFrameCallback);
        };

        window.addEventListener('message', onIFrameCallback);

        postFrameMessage({
          captureSourceId: true
        });

      } else {
        baseGetUserMedia(constraints, successCb, failureCb);
      }
    };

    window.getUserMedia = window.navigator.getUserMedia;

  } else {
    baseGetUserMedia = window.navigator.getUserMedia;

    window.navigator.getUserMedia = function (constraints, successCb, failureCb) {

      if (constraints && constraints.video && !!constraints.video.mediaSource) {
        // check if plugin is ready
        if(AdapterJS.WebRTCPlugin.pluginState === AdapterJS.WebRTCPlugin.PLUGIN_STATES.READY) {
          // TODO: use AdapterJS.WebRTCPlugin.callWhenPluginReady instead

          // check if screensharing feature is available
          if (!!AdapterJS.WebRTCPlugin.plugin.HasScreensharingFeature &&
            !!AdapterJS.WebRTCPlugin.plugin.isScreensharingAvailable) {

            // would be fine since no methods
            var updatedConstraints = JSON.parse(JSON.stringify(constraints));

            // set the constraints
            updatedConstraints.video.optional = updatedConstraints.video.optional || [];
            updatedConstraints.video.optional.push({
              sourceId: AdapterJS.WebRTCPlugin.plugin.screensharingKey || 'Screensharing'
            });

            delete updatedConstraints.video.mediaSource;
          } else {
            throw new Error('Your WebRTC plugin does not support screensharing');
          }
        } else {
          throw new Error('Your WebRTC plugin is not ready to be used yet');
        }
      }

      baseGetUserMedia(updatedConstraints, successCb, failureCb);
    };

    window.getUserMedia = window.navigator.getUserMedia;
  }

  if (window.webrtcDetectedBrowser === 'chrome') {
    var iframe = document.createElement('iframe');

    iframe.onload = function() {
      iframe.isLoaded = true;
    };

    iframe.src = 'https://cdn.temasys.com.sg/skylink/extensions/detection-script/detectRTC.html';
      //'https://temasys-cdn.s3.amazonaws.com/skylink/extensions/detection-script-dev/detectRTC.html';
    iframe.style.display = 'none';

    (document.body || document.documentElement).appendChild(iframe);

    var postFrameMessage = function (object) {
      object = object || {};

      if (!iframe.isLoaded) {
        setTimeout(function () {
          iframe.contentWindow.postMessage(object, '*');
        }, 100);
        return;
      }

      iframe.contentWindow.postMessage(object, '*');
    };
  }
})();