import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

// Mock UI Components (since we can't import from @/components/ui/)
const FileUpload = ({ onChange, accept }) => (
  <input 
    type="file" 
    accept={accept} 
    onChange={onChange} 
    className="block w-full text-sm text-slate-500
      file:mr-4 file:py-2 file:px-4
      file:rounded-full file:border-0
      file:text-sm file:font-semibold
      file:bg-violet-50 file:text-violet-700
      hover:file:bg-violet-100"
  />
);

const Select = ({ value, onChange, options }) => (
  <select 
    value={value} 
    onChange={onChange} 
    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
  >
    {options.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);

const Button = ({ children, onClick, disabled, className }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 ${className}`}
  >
    {children}
  </button>
);

const Card = ({ children, className }) => (
  <div className={`bg-white shadow-md rounded-lg ${className}`}>
    {children}
  </div>
);

const TranslationApp = () => {
  const [file, setFile] = useState(null);
  const [language, setLanguage] = useState('es');
  const [translatedText, setTranslatedText] = useState('');
  const [audioSrc, setAudioSrc] = useState(null);
  const [pdfPath, setPdfPath] = useState(null);
  const [audioPath, setAudioPath] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const languageOptions = [
    { value: 'hi', label: 'Hindi' },
    { value: 'kn', label: 'Kannada' },
    { value: 'bn', label: 'Bengali' },
    { value: 'te', label: 'Telugu' },
    { value: 'mr', label: 'Marathi' },
    { value: 'ta', label: 'Tamil' },
    { value: 'gu', label: 'Gujarati' },
    { value: 'en', label: 'English' },
    { value: 'ml', label: 'Malayalam' },
    { value: 'or', label: 'Odia' },
    { value: 'pa', label: 'Punjabi' },
    { value: 'ne', label: 'Nepali' }  ];

  const handleFileUpload = (event) => {
    setFile(event.target.files[0]);
    // Reset previous states
    setTranslatedText('');
    setAudioSrc(null);
    setPdfPath(null);
    setAudioPath(null);
    setError(null);
  };

  const handleTranslate = async () => {
    if (!file) {
      setError('Please upload a PDF first');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('language', language);

    setIsLoading(true);
    setError(null);

    try {
      const response = await axios.post('http://localhost:5000/translate', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000 // 2 minutes timeout
      });

      const { translated_text, pdf_path, audio_path } = response.data;
      setTranslatedText(translated_text);
      setPdfPath(pdf_path);
      setAudioPath(audio_path);

      // Fetch audio 
      const audioResponse = await axios.get(`http://localhost:5000/get_audio?path=${encodeURIComponent(audio_path)}`, {
        responseType: 'blob'
      });
      
      setAudioSrc(URL.createObjectURL(audioResponse.data));
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
      const errorMessage = error.response 
        ? error.response.data.error 
        : (error.message || 'An unexpected error occurred');
      setError(errorMessage);
      console.error('Translation error:', error);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const response = await axios.post('http://localhost:5000/download/pdf', 
        { pdf_path: pdfPath }, 
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'translated.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('PDF download error:', error);
      setError('Failed to download PDF');
    }
  };

  const handleDownloadAudio = async () => {
    try {
      const response = await axios.post('http://localhost:5000/download/audio', 
        { audio_path: audioPath }, 
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'translation.mp3');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Audio download error:', error);
      setError('Failed to download Audio');
    }
  };

  return (
    <div className="container mx-auto p-4">
      <Card className="p-6">
        <h1 className="text-2xl mb-4">TextTalker</h1>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="block mb-2">Upload PDF</label>
          <FileUpload 
            onChange={handleFileUpload}
            accept=".pdf"
          />
        </div>

        <div className="mb-4">
          <label className="block mb-2">Select Target Language</label>
          <Select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            options={languageOptions}
          />
        </div>
        <br/>
<center>
        <Button 
          onClick={handleTranslate}
          disabled={!file || isLoading}
          className="mb-4"
        >
          {isLoading ? 'Translating...' : 'Translate PDF'}
        </Button>
        </center>
        {isLoading && (
          <div className="flex justify-center items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        )}

        {translatedText && (
          <div className="mt-4">
            <h2 className="text-xl mb-2">Translated Text</h2>
            <div className="p-4 bg-gray-100 rounded">
              {translatedText}
            </div>
        {audioSrc && (
              <div className="mt-4">
                <audio controls src={audioSrc}>
                  Your browser does not support the audio element.
                </audio>
              </div>
          )}
          <center>
            <div className="mt-4 flex space-x-4">
              <Button onClick={handleDownloadPDF}>
                Download Translated PDF
              </Button>
              <br/><br/>
              <Button onClick={handleDownloadAudio}>
                Download Audio
              </Button>
            </div>
            </center>
           
          </div>
        )}
      </Card>
    </div>
  );
};

export default TranslationApp;