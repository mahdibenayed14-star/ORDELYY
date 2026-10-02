export async function mockVoice(page, { denied = false, recognition = true, delayedMicrophone = false, realAudio = false } = {}) {
  await page.addInitScript(({ denied, recognition, delayedMicrophone, realAudio }) => {
    const NativeContext = window.AudioContext || window.webkitAudioContext;
    window.__voiceLog = []; window.__recognizers = []; window.__sources = [];
    const track = { enabled: true, readyState: 'live', label: 'Micro de test simulé', stop() { this.readyState='ended'; window.__voiceLog.push('track.stop'); } };
    const stream = { getAudioTracks:()=>[track], getTracks:()=>[track] };
    window.__track = track;
    Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{
      if(denied) throw new DOMException('Denied','NotAllowedError');
      track.readyState='live';
      if(delayedMicrophone) return new Promise(resolve=>{window.__allowMicrophone=()=>resolve(stream);});
      if(realAudio) {
        const context=new NativeContext(), oscillator=context.createOscillator(), gain=context.createGain(), destination=context.createMediaStreamDestination();
        oscillator.frequency.value=440;gain.gain.value=0.025;
        oscillator.connect(gain);gain.connect(destination);oscillator.start();await context.resume();
        const actualTrack=destination.stream.getAudioTracks()[0], stop=actualTrack.stop.bind(actualTrack);
        actualTrack.stop=()=>{stop();oscillator.stop();context.close();};window.__track=actualTrack;
        return destination.stream;
      }
      return stream;
    }}});
    const node = () => ({connect(){},disconnect(){}});
    class Context {
      constructor(){this.sampleRate=48000;this.currentTime=0;this.destination=node();this.state='running';this.audioWorklet={addModule:async()=>{}};}
      resume(){return Promise.resolve();} close(){this.state='closed';return Promise.resolve();}
      createMediaStreamSource(){return node();} createGain(){return {...node(),gain:{value:0}};}
      createBuffer(_channels,length,rate){return {getChannelData:()=>new Float32Array(length),duration:length/rate};}
      createBufferSource(){const n={...node(),start(){window.__voiceLog.push('pcm.start');},stop(){window.__voiceLog.push('pcm.stop');}};window.__sources.push(n);return n;}
      createOscillator(){return {...node(),frequency:{value:0},start(){},stop(){}};}
    }
    if(!realAudio) {
      window.AudioContext=Context;
      window.AudioWorkletNode=class {constructor(){this.port={postMessage(){},onmessage:null};window.__worklet=this;}connect(){}disconnect(){}};
    }
    if(recognition){
      window.SpeechRecognition=class {
        constructor(){window.__recognizers.push(this);}
        start(){window.__voiceLog.push('recognition.start');setTimeout(()=>this.onstart?.(),0);}
        stop(){window.__voiceLog.push('recognition.stop');this.onend?.();}
        abort(){window.__voiceLog.push('recognition.abort');this.onend?.();}
      };
    } else {window.SpeechRecognition=undefined;window.webkitSpeechRecognition=undefined;}
    window.SpeechSynthesisUtterance=class {constructor(text){this.text=text;}};
    const synth={
      getVoices:()=>[{lang:'ar-TN',name:'Arabe de test simulé'},{lang:'fr-FR',name:'Français de test simulé'}],
      addEventListener(){},removeEventListener(){},
      speak(utterance){if(!utterance.text.trim())return;window.__utterance=utterance;window.__voiceLog.push('synthesis.speak');setTimeout(()=>utterance.onstart?.(),0);},
      cancel(){const current=window.__utterance;window.__utterance=null;window.__voiceLog.push('synthesis.cancel');current?.onerror?.({error:'canceled'});}
    };
    Object.defineProperty(window,'speechSynthesis',{configurable:true,value:synth});
    window.__emitRecognition=(text,final=false,index=0)=>{
      const rec=window.__recognizers.at(-1), results=[];
      for(let i=0;i<index;i++)results.push(Object.assign([{transcript:''}],{isFinal:true}));
      results.push(Object.assign([{transcript:text}],{isFinal:final}));
      rec.onresult?.({resultIndex:index,results});
    };
    window.__speechStart=()=>window.__worklet.port.onmessage({data:{type:'speech_start'}});
    window.__finishSpeech=()=>window.__utterance?.onend?.();
  }, { denied, recognition, delayedMicrophone, realAudio });
}
