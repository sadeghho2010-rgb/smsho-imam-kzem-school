import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  Circle, 
  Plus, 
  Trash2,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Todo } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function TodoList() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchTodos = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'todos'), orderBy('completed', 'asc'));
      const snapshot = await getDocs(q);
      setTodos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Todo)));
    } catch (error) {
      console.error("Error fetching todos:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodos();
  }, []);

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodo.trim()) return;
    try {
      await addDoc(collection(db, 'todos'), {
        title: newTodo,
        completed: false,
        createdAt: new Date().toISOString()
      });
      setNewTodo('');
      fetchTodos();
    } catch (error) {
      console.error("Error adding todo:", error);
    }
  };

  const toggleTodo = async (id: string, completed: boolean) => {
    try {
      await updateDoc(doc(db, 'todos', id), { completed: !completed });
      fetchTodos();
    } catch (error) {
      console.error("Error updating todo:", error);
    }
  };

  const deleteTodo = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'todos', id));
      fetchTodos();
    } catch (error) {
      console.error("Error deleting todo:", error);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8" dir="rtl">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-black text-slate-900">امور پیگیری (To-Do)</h2>
        <p className="text-xs text-slate-400">لیست کارهای مدیریتی و انضباطی طلاب پایه</p>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <form onSubmit={handleAddTodo} className="flex gap-3 mb-8">
          <input 
            type="text" 
            placeholder="مثلا: پیگیری غیبت‌های پایه دوم..."
            className="flex-1 px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 text-sm font-medium transition-all"
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
          />
          <button 
            type="submit"
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100"
          >
            <Plus size={18} />
            <span>افزودن</span>
          </button>
        </form>

        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {todos.map(todo => (
              <motion.div 
                key={todo.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={cn(
                  "flex items-center justify-between p-4 rounded-xl transition-all border",
                  todo.completed 
                    ? "bg-slate-50/50 border-slate-100 opacity-60" 
                    : "bg-white border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200"
                )}
              >
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => toggleTodo(todo.id, todo.completed)}
                    className={cn(
                      "transition-colors",
                      todo.completed ? "text-indigo-600" : "text-slate-300 hover:text-indigo-500"
                    )}
                  >
                    {todo.completed 
                      ? <div className="w-5 h-5 rounded border border-indigo-500 bg-indigo-50 flex items-center justify-center">
                          <CheckCircle size={14} className="text-indigo-600" />
                        </div>
                      : <div className="w-5 h-5 rounded border border-slate-300 bg-white"></div>
                    }
                  </button>
                  <span className={cn(
                    "text-sm font-bold text-slate-700 transition-all",
                    todo.completed && "line-through text-slate-400"
                  )}>
                    {todo.title}
                  </span>
                </div>
                <button 
                  onClick={() => deleteTodo(todo.id)}
                  className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>

          {!loading && todos.length === 0 && (
            <div className="py-20 text-center flex flex-col items-center gap-4 text-slate-300">
              <Calendar size={48} className="opacity-10" />
              <p className="font-bold text-sm">لیست پیگیری‌ها خالی است</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
