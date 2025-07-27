import { Paperclip, X } from "lucide-react";
import { useState, useRef } from "react";

interface FileUploadProps {
  onFileChange: (
    content: string | undefined,
    fileName: string | undefined
  ) => void;
  disabled?: boolean;
}

export const FileUpload = ({
  onFileChange,
  disabled = false,
}: FileUploadProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check if it's a text file
    const textFileTypes = [
      "text/plain",
      "text/markdown",
      "text/javascript",
      "text/typescript",
      "text/x-python",
      "application/json",
      "application/xml",
      "text/html",
      "text/css",
      "text/csv",
    ];

    const isTextFile =
      textFileTypes.includes(file.type) ||
      file.name.endsWith(".txt") ||
      file.name.endsWith(".md") ||
      file.name.endsWith(".js") ||
      file.name.endsWith(".ts") ||
      file.name.endsWith(".py") ||
      file.name.endsWith(".json") ||
      file.name.endsWith(".xml") ||
      file.name.endsWith(".html") ||
      file.name.endsWith(".css") ||
      file.name.endsWith(".csv");

    if (!isTextFile) {
      alert(
        "Please select a text file (.txt, .md, .js, .ts, .py, .json, .xml, .html, .css, .csv)"
      );
      return;
    }

    try {
      const content = await file.text();
      setSelectedFile(file);
      setFileName(file.name);
      onFileChange(content, file.name);
    } catch (error) {
      console.error("Error reading file:", error);
      alert("Error reading file. Please try again.");
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFileName(undefined);
    onFileChange(undefined, undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="absolute top-2 right-2 flex items-center gap-2">
      {selectedFile && (
        <div className="flex items-center gap-1 bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded-md text-xs">
          <span className="max-w-20 truncate">{fileName}</span>
          <button
            type="button"
            onClick={handleRemoveFile}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            disabled={disabled}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={handleButtonClick}
        disabled={disabled}
        className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="Attach file"
      >
        <Paperclip className="h-4 w-4" />
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md,.js,.ts,.py,.json,.xml,.html,.css,.csv,text/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
};
