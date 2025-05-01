# secretlife.fm

A minimalist website that displays a play button and plays audio once activated.

## Features

- Clean white interface with a centered play button
- Time-based functionality (activates at 2 PM PST)
- Background image appears at 2 PM PST
- Loading animation while audio is loading
- Play/Stop button functionality

## How to Use

1. Open `index.html` in a web browser to view the site
2. The play button will only function after 2 PM PST
3. When clicked, the play button changes to a loading animation while the audio loads
4. Once loaded, the animation changes to a stop button
5. Clicking the stop button pauses the audio and returns to the play button

## Adding the Media File

To add the audio file (white noise) when it's available:

1. Add the audio file to the project directory
2. Open `script.js` and locate line 35 (approximately)
3. Update the commented line to point to your audio file:
   ```javascript
   audioPlayer.src = 'your-audio-filename.mp3';
   ```

## Testing the Time-Based Feature

To test the 2 PM PST feature without waiting:
1. Temporarily modify the `isAfter2PMPST()` function in `script.js` to return `true`
2. Test the functionality 
3. Revert the change before deploying

## Deployment

The site can be deployed to any standard web hosting service. Simply upload all files maintaining the same directory structure.
