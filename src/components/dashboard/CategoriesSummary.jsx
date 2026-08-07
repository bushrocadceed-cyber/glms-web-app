import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tag } from 'lucide-react';
import { getCategorySummary } from '../../services/bookService';

export default function CategoriesSummary() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getCategorySummary()
      .then((data) => {
        if (!cancelled) setCategories(data ?? []);
      })
      .catch(() => {
        if (!cancelled) setCategories([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex h-full flex-col rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
      <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">Book Categories</h3>

      {loading && (
        <div className="flex flex-wrap gap-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-9 w-24 animate-pulse rounded-full bg-slate-100 dark:bg-slate-700" />
          ))}
        </div>
      )}

      {!loading && categories.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No categories yet — add one from the Books page.
        </p>
      )}

      {!loading && categories.length > 0 && (
        <div className="flex flex-1 flex-wrap content-start gap-2.5">
          {categories.map(({ category, count }) => (
            <button
              key={category}
              type="button"
              onClick={() => navigate(`/inventory?category=${encodeURIComponent(category)}`)}
              className="flex items-center gap-2 rounded-full bg-primary-50 px-4 py-2 text-sm font-medium text-primary-700 hover:bg-primary-100 dark:bg-primary-900/40 dark:text-primary-300 dark:hover:bg-primary-900/70"
            >
              <Tag className="h-3.5 w-3.5" />
              {category}
              <span className="rounded-full bg-primary-600 px-2 py-0.5 text-xs font-semibold text-white">
                {count}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
