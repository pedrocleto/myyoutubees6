const App = (() => {
  // Retrieve your client ID from the Google Developers Console at
  // https://console.developers.google.com/.
  const OAUTH2_CLIENT_ID = '524031306714-8n7ih5iuk3r8k1fjulagfu9jcmmq5i55.apps.googleusercontent.com';
  const OAUTH2_SCOPES = [
    'https://www.googleapis.com/auth/youtube.readonly'
  ];

  const ONE_MONTH_IN_MILLISECONDS = 1000 * 60 * 60 * 24 * 30;

  // Keep track of the currently authenticated user's YouTube channel ID.
  let myChannelId;
  let comboSelection;
  let container;
  let player;

  // Upon loading, the Google APIs JS client automatically invokes this callback.
  // See https://developers.google.com/api-client-library/javascript/features/authentication
  window.onJSClientLoad = ()=> {
    gapi.auth.init(()=> {
      window.setTimeout(checkAuth, 1);
    });
  };

  // Attempt the immediate OAuth 2.0 client flow as soon as the page loads.
  // If the currently logged-in Google Account has previously authorized
  // the client specified as the OAUTH2_CLIENT_ID, then the authorization
  // succeeds with no user intervention. Otherwise, it fails and the
  // user interface that prompts for authorization needs to display.
  let checkAuth = () =>{
    gapi.auth.authorize({
      client_id: OAUTH2_CLIENT_ID,
      scope: OAUTH2_SCOPES,
      immediate: true
    }, handleAuthResult);
  }

  let hide = (element) =>{ document.querySelectorAll(element)[0].style.display = 'none'};
  let show = (element) =>{ document.querySelectorAll(element)[0].style.display = 'block'};
  // Handle the result of a gapi.auth.authorize() call.
  let handleAuthResult = (authResult)=> {
    if (authResult && !authResult.error) {
      // Authorization was successful. Hide authorization prompts and show
      // content that should be visible after authorization succeeds.

      hide('.pre-auth');
      show('.post-auth');

      loadAPIClientInterfaces();
    } else {
      // Authorization was unsuccessful. Show content related to prompting for
      // authorization and hide content that should be visible if authorization
      // succeeds.

      hide('.post-auth');
      show('.pre-auth');

      // Make the #login-link clickable. Attempt a non-immediate OAuth 2.0
      // client flow. The current function is called when that flow completes.
      $('#login-link').click(()=> {
        gapi.auth.authorize({
          client_id: OAUTH2_CLIENT_ID,
          scope: OAUTH2_SCOPES,
          immediate: false
        }, handleAuthResult);
      });
    }
  }

  // Load the client interfaces for the YouTube Analytics and Data APIs, which
  // are required to use the Google APIs JS client. More info is available at
  // https://developers.google.com/api-client-library/javascript/dev/dev_jscript#loading-the-client-library-and-the-api
  let loadAPIClientInterfaces = ()=> {
    gapi.client.load('youtube', 'v3', ()=> {
        // After both client interfaces load, use the Data API to request
        // information about the authenticated user's channel.
        comboSelection = document.getElementById('comboSelection');
        container = document.querySelectorAll('.container')[0];
        comboSelection.addEventListener("change",()=> {
          getUserChannel();
        });
        getUserChannel();
    });
  }

  let clearList = () =>{
    let videoList = document.querySelectorAll('#video-list')[0];
    if(videoList){
      while (videoList.hasChildNodes()) {
          videoList.removeChild(videoList.lastChild);
      }
    }
    if(player){
      player.destroy();
      player = undefined;
    }

    hide('#ytplayer');
  }

  // Call the Data API to retrieve information about the currently
  // authenticated user's YouTube channel.
  let getUserChannel = () => {

    container.classList.add("loading");
    clearList();
    hideMessage();
    // Also see: https://developers.google.com/youtube/v3/docs/channels/list
    let request = gapi.client.youtube.channels.list({
      // Setting the "mine" request parameter's value to "true" indicates that
      // you want to retrieve the currently authenticated user's channel.
      mine: true,
      part: 'id,contentDetails'
    });

    request.execute((response) => {
      if ('error' in response) {
        displayMessage(response.error.message);
      } else {
        // We need the channel's channel ID to make calls to the Analytics API.
        // The channel ID value has the form "UCdLFeWKpkLhkguiMZUp8lWA".
        myChannelId = response.items[0].id;
        // Retrieve the playlist ID that uniquely identifies the playlist of
        // videos uploaded to the authenticated user's channel. This value has
        // the form "UUdLFeWKpkLhkguiMZUp8lWA".
        let value = comboSelection.value;
        let uploadsListId = response.items[0].contentDetails.relatedPlaylists[value];
        // Use the playlist ID to retrieve the list of uploaded videos.
        getPlaylistItems(uploadsListId);
      }
    });
  }

  // Call the Data API to retrieve the items in a particular playlist. In this
  // example, we are retrieving a playlist of the currently authenticated user's
  // uploaded videos. By default, the list returns the most recent videos first.
  let getPlaylistItems = (listId)=> {
    // See https://developers.google.com/youtube/v3/docs/playlistitems/list
    let request = gapi.client.youtube.playlistItems.list({
      playlistId: listId,
      part: 'snippet',
      maxResults: 50
    });

    request.execute((response)=> {
      if ('error' in response) {
        displayMessage(response.error.message);
      } else {
        if ('items' in response) {
          // The jQuery.map() function iterates through all of the items in
          // the response and creates a new array that only contains the
          // specific property we're looking for: videoId.
          let videoIds = $.map(response.items, (item)=> {
            return item.snippet.resourceId.videoId;
          });

          // Now that we know the IDs of all the videos in the uploads list,
          // we can retrieve information about each video.
          getVideoMetadata(videoIds);
        } else {
          displayMessage('There are no videos in your channel.');
        }
      }
    });
  }

  // Given an array of video IDs, this function obtains metadata about each
  // video and then uses that metadata to display a list of videos.
  let getVideoMetadata = (videoIds)=> {
    // https://developers.google.com/youtube/v3/docs/videos/list
    let request = gapi.client.youtube.videos.list({
      // The 'id' property's value is a comma-separated string of video IDs.
      id: videoIds.join(','),
      part: 'id,snippet,statistics'
    });

    request.execute((response)=> {
      container.classList.remove("loading");
      if ('error' in response) {
        displayMessage(response.error.message);
      } else {
        // Get the jQuery wrapper for the #video-list element before starting
        // the loop.
        let videoListQ = $('#video-list');
        response.items.forEach((item) => {

          let title = item.snippet.title;
          let videoId = item.id;

          let channelId = item.snippet.channelId;

          // Create a new <li> element that contains an <a> element.
          // Set the <a> element's text content to the video's title, and
          // add a click handler that will display Analytics data when invoked.
          let liElement = $('<li>');
          let aElement = $('<a>');
          // Setting the href value to '#' ensures that the browser renders the
          // <a> element as a clickable link.
          aElement.attr('href', '#');
          aElement.text(title);
          aElement.click(function() {
            displayVideo(videoId)
            //let url= 'https://www.youtube.com/watch?v='+videoId;
            //window.open(url);
          });

          // Call the jQuery.append() method to add the new <a> element to
          // the <li> element, and the <li> element to the parent
          // list, which is identified by the 'videoList' variable.
          liElement.append(aElement);
          videoListQ.append(liElement);
        });

        if (videoListQ.children().length == 0) {
          // Display a message if the channel does not have any viewed videos.
          displayMessage('Your channel does not have any videos that have been viewed.');
        }
        else{
            show('#ytplayer');
        }
      }
    });
  }

  let displayVideo = (videoId)=> {
      if(player == undefined){
        player = new YT.Player('ytplayer', {
          height: '390',
          width: '640',
          videoId: videoId,
          events: {
            'onReady': onPlayerReady
          }
        });
      }
      else {
        player.loadVideoById(videoId,
                           0,
                           'hd720');
      }
  }

  let onPlayerReady = (event)=> {
      event.target.setVolume(100);
  }
  // This helper method displays a message on the page.
  let displayMessage = (message)=>{
    let messageEL = document.querySelectorAll('#message')[0];
    messageEL.value= message;
    show('#message');
  }

  // This helper method hides a previously displayed message on the page.
  let hideMessage = ()=> {
    hide('#message');
  }
});

export default App;
