import ReactMarkdown from 'react-markdown';

interface ChatMessageProps {
  role: 'user' | 'model';
  text: string;
}

export default function ChatMessage({ role, text }: ChatMessageProps) {
  const isModel = role === 'model';

  return (
    <div className={`flex items-start gap-4 my-4 ${isModel ? '' : 'flex-row-reverse'}`}>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${isModel ? 'bg-blue-500' : 'bg-green-500'}`}>
        {isModel ? 'AI' : 'You'}
      </div>
      <div className={`p-4 rounded-lg max-w-2xl prose ${isModel ? 'bg-white dark:bg-gray-700' : 'bg-green-100 dark:bg-green-900'}`}>
        <ReactMarkdown>{text}</ReactMarkdown>
      </div>
    </div>
  );
}