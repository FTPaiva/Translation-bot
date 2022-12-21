const fs = require('fs')
const { Readable } = require('stream')

const Discord = require('discord.js')

const ffmpeg = require('fluent-ffmpeg')
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path
ffmpeg.setFfmpegPath(ffmpegPath)





const path = require('path');

const ffprobePath = require('@ffprobe-installer/ffprobe').path;

ffmpeg.setFfprobePath(ffprobePath);

const audio = path.join(__dirname, './converted.wav');

const { IamAuthenticator } = require('ibm-watson/auth');
const SpeechToTextV1 = require('ibm-watson/speech-to-text/v1');

const credentials = require('./src/apikey-ibm-cloud.json');
const LanguageTranslatorV3 = require('ibm-watson/language-translator/v3');


const languageTranslator = new LanguageTranslatorV3({
  version: '2018-05-01',
  authenticator: new IamAuthenticator({
    apikey: 'bb4KT4-XsWAeTWHRQfC1bivEnI5U9r_L_5OdyWubDvo8',
  }),
  serviceUrl: 'https://api.us-south.language-translator.watson.cloud.ibm.com/instances/532aa5dd-b80e-4cd7-8e4e-dbf31ecc53a9',
});


var language1 = 'pt'
var language2 = 'en'
var model1 = 'pt-BR_Multimedia'
var model2 = 'en-US_Multimedia'

var models = {
  'pt': 'pt-BR_Multimedia', // Portuguese - BR
  'en': 'en-US_Multimedia', // English - US
  'ja': 'ja-JP_Multimedia', // Japanese
  'it': 'it-IT_Multimedia', // Italian
  'es': 'es-ES_Multimedia', // Spanish - Spain
  'ko': 'ko-KR_Multimedia', // Korean
  'de': 'de-DE_Multimedia', // German
  'fr': 'fr-FR_Multimedia'  // French - France
}




async function transcription(ctx) {
  speechToText();
  let m = model1
  model1 = model2
  model2 = m

async function speechToText() {
  const speechToText = new SpeechToTextV1({
      authenticator: new IamAuthenticator({
        apikey: credentials.apikey,
      }),
      serviceUrl: credentials.url,
    });
    
    const params = {
      objectMode: false,
      contentType: 'audio/wav',
      model: model1,
      maxAlternatives: 3,
    };
    
    // Create the stream.
    const recognizeStream = speechToText.recognizeUsingWebSocket(params);
    
    // Pipe in the audio.
    fs.createReadStream(audio).pipe(recognizeStream);
    
    recognizeStream.pipe(fs.createWriteStream('transcription.txt'));
    
    recognizeStream.setEncoding('utf8');
    
    // Listen for events.
    recognizeStream.on('data', function(event) { onEvent('Data:', event); });
      
}


// Display events on the console.
async function onEvent(name, event) {
  
  const translateParams = {
    text: JSON.stringify(event, null, 2),
    modelId: language1 + '-' + language2,
  };
  console.log('l1: '+ language1 + ', l2: ' + language2)
  ctx.channel.send('Tradução de `' + language1 + '` para `' + language2 + '`:')
  ctx.channel.send(JSON.stringify(event, null, 2).slice(1,-1))
  
  languageTranslator.translate(translateParams)
    .then(translationResult => {
      let translation = JSON.stringify(translationResult.result.translations[0].translation, null, 2).slice(3,-3)
      console.log(JSON.stringify(event, null, 2));
      console.log(translation);
      ctx.channel.send(translation, {tts: true})
    })
    .catch(err => {
      console.log('error:', err);
    });
    let l = language1
    language1 = language2
    language2 = l
  
};

}

// Noiseless stream of audio to send when the bot joins a voice channel
class Silence extends Readable {
  _read() {
    this.push(Buffer.from([0xF8, 0xFF, 0xFE]))
  }
}


const config = JSON.parse(fs.readFileSync('config.json'))
const client = new Discord.Client()

client.on('ready', () => {
  console.log(`Bot ligado.`)
})

client.on('message', async ctx => {
  if (!ctx.content.startsWith(config.prefix)) return
  

  const command = ctx.content.slice(config.prefix.length).split(' ')
  if (command.length == 3 && command[0] == "l") {
      language1 = command[1]
      language2 = command[2]
      model1 = models[command[1]]
      model2 = models[command[2]]
      console.log('l1: '+ language1 + ', l2: ' + language2)
      ctx.channel.send('Línguas alteradas!\nLingua 1: ' + language1 + '\nLingua 2: ' + language2)
  }

  switch (command[0]) {
    case 'entrar':
      if (ctx.member.voice.channel) {
        const connection = await ctx.member.voice.channel.join()

        connection.play(new Silence(), { type: 'opus' })
        ctx.channel.send('Estou ouvindo...')

        connection.on('speaking', async (user, speaking) => {
          if (speaking.has('SPEAKING')) {


            let audioStream = connection.receiver.createStream(user, { mode: 'pcm' })
            console.log(user.username)

            audioStream.pipe(fs.createWriteStream('user_audio.pcm'))
            
            let convertedAudio = ffmpeg(audioStream)
              .inputFormat('s32le')
              .audioFrequency(44100)
              .audioChannels(1)
              .audioCodec('pcm_s16le')
              .format('wav')
              .pipe(fs.createWriteStream('converted.wav'))
            
          }
        })
      }
      break

    case 't':
      transcription(ctx)
      break

    case 'sair':
      try { ctx.guild.voice.channel.leave() } catch {}
      break

    case 'ajuda':
      ctx.channel.send('❗**Meus comandos**❗\n\n'+
      '`entrar` - entro no seu canal de voz.\n'+
      '`sair` - saio do seu canal de voz.\n'+
      '`l {língua 1} {língua 2}` - define as línguas a serem usadas\n'+
      '`t` - traduzo os últimos segundos de áudio\n'+
      '`linguas` - listo todas as línguas disponíveis para uso')
      break

    case 'linguas':
      ctx.channel.send('**Línguas disponíveis**:\n\n'+
      '`pt`: Portuguese - BR\n'+
      '`en`: English - US\n'+
      '`ja`: Japanese\n'+
      '`it`: Italian\n'+
      '`es`: Spanish - Spain\n'+
      '`ko`: Korean\n'+
      '`de`: German\n'+
      '`fr`: French - France\n')
      break

    default:
      break
  }
})

client.login(config.token)
