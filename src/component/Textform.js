import React,{useState} from 'react'

export default function Textform(props) {
    
    const[text,setText]=useState('')

    const handleUpclick=()=>{
        let newText=text.toUpperCase();
        setText(newText)
        props.alert("Text are converted into upperCase")
    }
    
    const changeHandle=(event)=>{
        setText(event.target.value)
    }
    
    const handleLowclick=()=>{

      let newtwxt=text.toLocaleLowerCase();
      setText(newtwxt);
      props.alert("Text are converted into LoweCase")

    }
    const handleClear=()=>{

      let newtwxt=''
      setText(newtwxt);
      props.alert("you have cleared the message")
      

    }
    const handleCopy=()=>{

      navigator.clipboard.writeText(text);
      props.alert("you have copied the message")

    }
    const handleRemove=()=>{
      let newtext="",temp="";
       for (let i=0;i<text.length;i++)
       {
          if(text[i]===" ")
           {
            if(temp!=="")
            {
              newtext+=temp;
              newtext+=" ";
              temp="";
            }
           }
           else
           {
             temp+=text[i];
           }
       }

      newtext+=temp;
      //newtext=text.split(/\s+/)
      setText(newtext);
      props.alert("you have removed the extra spaces")

    }

  return (
    <>
    <div>
       <h1>heading</h1>
       <div className='mb-3'>
            <textarea className='form-control' id="myBox" rows="8" value={text} onChange={changeHandle}></textarea>
       </div>
       <button disabled={text.length===0} className='btn btn-primary mx-2 my-1' onClick={handleUpclick}>convert upper</button>
       <button disabled={text.length===0}  className='btn btn-primary mx-2  my-1' onClick={handleLowclick}>convert lower</button>
       <button disabled={text.length===0}  className='btn btn-primary mx-2  my-1' onClick={handleClear}>Clear Text</button>
       <button disabled={text.length===0}  className='btn btn-primary mx-2  my-1' onClick={handleCopy}>Copy text</button>
       <button disabled={text.length===0}  className='btn btn-primary mx-2  my-1' onClick={handleRemove}>Remove extra spaces</button>
    </div>

    <div>
         <h2>Your text summary</h2>
         <p>Number of characters: {text.length} <br/>Number of words:{text.split(/\s+/).filter((val)=> {return val.length!==0}).length}</p>
    </div>
    </>
  )
}
