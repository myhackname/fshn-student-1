import React, { useState, useEffect } from 'react';
import { Book, Download, Upload, FileText, Search, Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BookType {
  id: number;
  title: string;
  author: string;
  file_path: string;
  uploader_name: string;
  created_at: string;
}

interface LibraryProps {
  user: any;
  token: string;
}

const Library: React.FC<LibraryProps> = ({ user, token }) => {
  const [books, setBooks] = useState<BookType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    file: null as File | null
  });

  useEffect(() => {
    fetchBooks();
  }, []);

  const fetchBooks = async () => {
    try {
      const res = await fetch('/api/library/books', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setBooks(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.file) return;

    setUploadLoading(true);
    const data = new FormData();
    data.append('title', formData.title);
    data.append('author', formData.author);
    data.append('file', formData.file);

    try {
      const res = await fetch('/api/library/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: data
      });
      if (res.ok) {
        setShowUpload(false);
        setFormData({ title: '', author: '', file: null });
        fetchBooks();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setUploadLoading(false);
    }
  };

  const filteredBooks = books.filter(book => 
    book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    book.author.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const canUpload = user?.role === 'TEACHER' || user?.is_class_admin;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Libraria Digjitale</h2>
          <p className="text-slate-500">Akseso librat dhe materialet e klasës tënde</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Kërko libra..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-64"
            />
          </div>
          {canUpload && (
            <button 
              onClick={() => setShowUpload(true)}
              className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
            >
              <Plus size={20} />
              <span className="hidden sm:inline">Shto Libër</span>
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredBooks.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Book size={40} className="text-slate-300" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Asnjë libër nuk u gjet</h3>
          <p className="text-slate-500">Nuk ka materiale të disponueshme për momentin.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredBooks.map((book) => (
            <motion.div 
              key={book.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-xl transition-all group"
            >
              <div className="w-full aspect-[3/4] bg-slate-50 rounded-2xl mb-4 flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                <FileText size={64} className="text-slate-200 group-hover:text-blue-200 transition-colors" />
              </div>
              <h3 className="font-bold text-slate-900 mb-1 line-clamp-1">{book.title}</h3>
              <p className="text-sm text-slate-500 mb-4">{book.author}</p>
              
              <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                <div className="text-[10px] text-slate-400">
                  <p className="font-bold uppercase tracking-wider">Ngarkuar nga</p>
                  <p>{book.uploader_name}</p>
                </div>
                <a 
                  href={book.file_path} 
                  download 
                  className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all"
                  title="Shkarko"
                >
                  <Download size={18} />
                </a>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showUpload && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative"
            >
              <button 
                onClick={() => setShowUpload(false)}
                className="absolute right-6 top-6 text-slate-400 hover:text-slate-600"
              >
                <X size={24} />
              </button>
              
              <h3 className="text-2xl font-bold text-slate-900 mb-6">Shto Libër të Ri</h3>
              
              <form onSubmit={handleUpload} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Titulli</label>
                  <input 
                    type="text" 
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Titulli i librit..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Autori</label>
                  <input 
                    type="text" 
                    value={formData.author}
                    onChange={(e) => setFormData({...formData, author: e.target.value})}
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Emri i autorit..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">File (PDF, DOC, etj.)</label>
                  <input 
                    type="file" 
                    required
                    onChange={(e) => setFormData({...formData, file: e.target.files?.[0] || null})}
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>
                
                <button 
                  disabled={uploadLoading}
                  className="w-full bg-blue-600 text-white p-4 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50 mt-4"
                >
                  {uploadLoading ? 'Duke u ngarkuar...' : 'Publiko Librin'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Library;
