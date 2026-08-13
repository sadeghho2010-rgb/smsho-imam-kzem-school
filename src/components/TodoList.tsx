import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  Circle, 
  Plus, 
  Trash2,
  Calendar,
  AlertCircle,
  BookOpen,
  Bookmark,
  BarChart2
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
  const [filter, setFilter] = useState<'all' | 'general' | 'research' | 'study'>('all');

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

  const isResearch = (t: Todo) => !!t.isResearchFollowUp;
  const isStudy = (t: Todo) => !!t.isStudyFollowUp || (t.title && t.title.includes('[پیگیری مطالعه]'));

  const filteredTodos = todos.filter(t => {
    if (filter === 'general') return !isResearch(t) && !isStudy(t);
    if (filter === 'research') return isResearch(t);
    if (filter === 'study') return isStudy(t);
    return true;
  });

  const generalCount = todos.filter(t => !isResearch(t) && !isStudy(t)).length;
  const researchCount = todos.filter(t => isResearch(t)).length;
  const studyCount = todos.filter(t => isStudy(t)).length;

  return (
    <div className="max-w-3xl mx-auto space-y-8" dir="rtl">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-black text-slate-900">پیگیری‌ها</h2>
        <p className="text-xs text-slate-400">لیست کارهای مدیریتی، انضباطی، پیگیری‌های پژوهشی و مطالعاتی طلاب</p>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <form onSubmit={handleAddTodo} className="mb-6">
          <div className="flex gap-3">
            <input 
              type="text" 
              placeholder="مثلا: پیگیری غیبت‌های پایه دوم..."
              className="flex-1 px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-medium transition-all"
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTodo(e);
                }
              }}
            />
            <button 
              type="submit"
              className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100 shrink-0"
            >
              <Plus size={18} />
              <span>ENTER</span>
            </button>
          </div>
        </form>

        {/* Filter Tabs */}
        <div className="flex items-center justify-center flex-wrap gap-2 mb-6 p-1 bg-slate-100 rounded-xl w-fit mx-auto text-xs font-bold">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={cn(
              "px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5",
              filter === 'all' ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
            )}
          >
            <span>همه</span>
            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px]">{todos.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setFilter('general')}
            className={cn(
              "px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5",
              filter === 'general' ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
            )}
          >
            <span>عمومی</span>
            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px]">{generalCount}</span>
          </button>
          <button
            type="button"
            onClick={() => setFilter('research')}
            className={cn(
              "px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5",
              filter === 'research' ? "bg-purple-600 text-white shadow-sm" : "text-purple-700 hover:bg-purple-50"
            )}
          >
            <BookOpen size={13} />
            <span>پیگیری‌های پژوهشی</span>
            <span className={cn(
              "px-1.5 py-0.5 rounded-md text-[10px]",
              filter === 'research' ? "bg-purple-700 text-white" : "bg-purple-100 text-purple-700"
            )}>
              {researchCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setFilter('study')}
            className={cn(
              "px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5",
              filter === 'study' ? "bg-amber-600 text-white shadow-sm" : "text-amber-800 hover:bg-amber-50"
            )}
          >
            <BarChart2 size={13} />
            <span>پیگیری‌های مطالعاتی</span>
            <span className={cn(
              "px-1.5 py-0.5 rounded-md text-[10px]",
              filter === 'study' ? "bg-amber-700 text-white" : "bg-amber-100 text-amber-800"
            )}>
              {studyCount}
            </span>
          </button>
        </div>

        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filteredTodos.map(todo => {
              const itemIsResearch = isResearch(todo);
              const itemIsStudy = isStudy(todo);

              return (
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
                      : itemIsResearch 
                        ? "bg-purple-50/50 border-purple-200 border-r-4 border-r-purple-600 shadow-sm hover:shadow-md"
                        : itemIsStudy
                          ? "bg-amber-50/50 border-amber-200 border-r-4 border-r-amber-500 shadow-sm hover:shadow-md"
                          : "bg-white border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200"
                  )}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <button 
                      onClick={() => toggleTodo(todo.id, todo.completed)}
                      className={cn(
                        "transition-colors shrink-0",
                        todo.completed 
                          ? (itemIsResearch ? "text-purple-600" : itemIsStudy ? "text-amber-600" : "text-indigo-600") 
                          : "text-slate-300 hover:text-indigo-500"
                      )}
                    >
                      {todo.completed 
                        ? <div className={cn(
                            "w-5 h-5 rounded border flex items-center justify-center",
                            itemIsResearch 
                              ? "border-purple-500 bg-purple-50" 
                              : itemIsStudy
                                ? "border-amber-500 bg-amber-50"
                                : "border-indigo-500 bg-indigo-50"
                          )}>
                            <CheckCircle size={14} className={itemIsResearch ? "text-purple-600" : itemIsStudy ? "text-amber-600" : "text-indigo-600"} />
                          </div>
                        : <div className="w-5 h-5 rounded border border-slate-300 bg-white"></div>
                      }
                    </button>
                    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn(
                          "text-sm font-bold text-slate-800 transition-all leading-snug",
                          todo.completed && "line-through text-slate-400"
                        )}>
                          {todo.title}
                        </span>
                        {itemIsResearch && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-purple-100 text-purple-800 border border-purple-200 rounded-full text-[10px] font-black shrink-0">
                            <BookOpen size={11} className="text-purple-600" />
                            <span>پیگیری پژوهشی</span>
                          </span>
                        )}
                        {itemIsStudy && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 rounded-full text-[10px] font-black shrink-0">
                            <BarChart2 size={11} className="text-amber-600" />
                            <span>پیگیری مطالعاتی</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => deleteTodo(todo.id)}
                    className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors mr-2 shrink-0"
                    title="حذف پیگیری"
                  >
                    <Trash2 size={16} />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {!loading && filteredTodos.length === 0 && (
            <div className="py-20 text-center flex flex-col items-center gap-4 text-slate-300">
              <Calendar size={48} className="opacity-10" />
              <p className="font-bold text-sm">هیچ پیگیری یافت نشد</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
