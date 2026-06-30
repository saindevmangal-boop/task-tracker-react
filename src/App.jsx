import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const STORAGE_KEY = 'prodeskit-board';
const COLUMN_TITLES = {
  todo: 'To Do',
  inProgress: 'In Progress',
  done: 'Done',
};

function getInitialColumns() {
  return {
    todo: [],
    inProgress: [],
    done: [],
  };
}

function App() {
  const [columns, setColumns] = useState(() => {
    if (typeof window === 'undefined') {
      return getInitialColumns();
    }

    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return getInitialColumns();
      }
    }
    return getInitialColumns();
  });
  const [taskText, setTaskText] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(columns));
    }
  }, [columns]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleAddTask = (event) => {
    event.preventDefault();
    const text = taskText.trim();
    if (!text) {
      return;
    }

    const newTask = {
      id: crypto.randomUUID(),
      text,
      priority,
      editedText: text,
      editing: false,
    };

    setColumns((prev) => ({
      ...prev,
      todo: [...prev.todo, newTask],
    }));
    setTaskText('');
    setPriority('Medium');
  };

  const deleteTask = (columnKey, id) => {
    setColumns((prev) => ({
      ...prev,
      [columnKey]: prev[columnKey].filter((task) => task.id !== id),
    }));
  };

  const moveTask = (columnKey, id, direction) => {
    const keys = Object.keys(COLUMN_TITLES);
    const currentIndex = keys.indexOf(columnKey);
    const nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;

    if (nextIndex < 0 || nextIndex >= keys.length) {
      return;
    }

    const targetKey = keys[nextIndex];

    setColumns((prev) => {
      const taskToMove = prev[columnKey].find((task) => task.id === id);
      if (!taskToMove) {
        return prev;
      }

      return {
        ...prev,
        [columnKey]: prev[columnKey].filter((task) => task.id !== id),
        [targetKey]: [...prev[targetKey], taskToMove],
      };
    });
  };

  const toggleEdit = (columnKey, id) => {
    setColumns((prev) => ({
      ...prev,
      [columnKey]: prev[columnKey].map((task) =>
        task.id === id ? { ...task, editing: !task.editing } : task
      ),
    }));
  };

  const saveEdit = (columnKey, id) => {
    setColumns((prev) => ({
      ...prev,
      [columnKey]: prev[columnKey].map((task) =>
        task.id === id ? { ...task, editing: false, text: task.editedText.trim() || task.text } : task
      ),
    }));
  };

  const handleEditChange = (columnKey, id, value) => {
    setColumns((prev) => ({
      ...prev,
      [columnKey]: prev[columnKey].map((task) =>
        task.id === id ? { ...task, editedText: value } : task
      ),
    }));
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const activeId = active.id;
    const overId = over.id;

    const sourceColumn = Object.keys(columns).find((key) =>
      columns[key].some((task) => task.id === activeId)
    );

    const targetColumn = (over.data.current?.sortable?.containerId ?? overId) in columns
      ? (over.data.current?.sortable?.containerId ?? overId)
      : Object.keys(columns).find((key) => columns[key].some((task) => task.id === overId));

    if (!sourceColumn || !targetColumn) {
      return;
    }

    setColumns((prev) => {
      const sourceTasks = [...prev[sourceColumn]];
      const targetTasks = [...prev[targetColumn]];
      const activeTask = sourceTasks.find((task) => task.id === activeId);
      if (!activeTask) {
        return prev;
      }

      const sourceWithoutActive = sourceTasks.filter((task) => task.id !== activeId);

      if (sourceColumn === targetColumn) {
        const oldIndex = sourceTasks.findIndex((task) => task.id === activeId);
        const newIndex = sourceTasks.findIndex((task) => task.id === overId);
        return {
          ...prev,
          [sourceColumn]: arrayMove(sourceTasks, oldIndex, newIndex >= 0 ? newIndex : sourceTasks.length - 1),
        };
      }

      return {
        ...prev,
        [sourceColumn]: sourceWithoutActive,
        [targetColumn]: [...targetTasks, activeTask],
      };
    });
  };

  const filteredColumns = useMemo(() => {
    const searchTerm = search.toLowerCase();
    return Object.fromEntries(
      Object.entries(columns).map(([key, tasks]) => [
        key,
        tasks.filter((task) => task.text.toLowerCase().includes(searchTerm)),
      ])
    );
  }, [columns, search]);

  return (
    <div className="app-shell">
      <div className="board-header">
        <div>
          <span className="eyebrow">Sprint Board</span>
          <h1>Task Management Board</h1>
        </div>
        <div className="search-wrap">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search tasks"
            className="search-input"
          />
        </div>
      </div>

      <form className="task-form" onSubmit={handleAddTask}>
        <input
          className="task-input"
          value={taskText}
          onChange={(event) => setTaskText(event.target.value)}
          placeholder="Add a task"
        />
        <select
          className="priority-select"
          value={priority}
          onChange={(event) => setPriority(event.target.value)}
        >
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
        <button className="add-button" type="submit">
          Add Task
        </button>
      </form>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="board">
          {Object.entries(COLUMN_TITLES).map(([key, title]) => (
            <Column
              key={key}
              title={title}
              tasks={filteredColumns[key] || []}
              columnKey={key}
              onDelete={deleteTask}
              onMove={moveTask}
              onToggleEdit={toggleEdit}
              onSaveEdit={saveEdit}
              onEditChange={handleEditChange}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}

function Column({ title, tasks, columnKey, onDelete, onMove, onToggleEdit, onSaveEdit, onEditChange }) {
  const taskIds = tasks.map((task) => task.id);
  const { setNodeRef } = useDroppable({ id: columnKey });

  return (
    <section ref={setNodeRef} className="column" id={columnKey}>
      <div className="column-title-wrap">
        <h2>{title}</h2>
        <span className="column-count">{tasks.length}</span>
      </div>
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className="task-list" data-column-id={columnKey}>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              columnKey={columnKey}
              onDelete={() => onDelete(columnKey, task.id)}
              onMove={(direction) => onMove(columnKey, task.id, direction)}
              onToggleEdit={() => onToggleEdit(columnKey, task.id)}
              onSaveEdit={() => onSaveEdit(columnKey, task.id)}
              onEditChange={(value) => onEditChange(columnKey, task.id, value)}
            />
          ))}
        </div>
      </SortableContext>
    </section>
  );
}

function TaskCard({ task, columnKey, onDelete, onMove, onToggleEdit, onSaveEdit, onEditChange }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article ref={setNodeRef} style={style} {...attributes} {...listeners} className={`task-card ${task.priority.toLowerCase()}`}>
      <div className="task-top">
        <span className={`priority-badge ${task.priority.toLowerCase()}`}>{task.priority}</span>
        <div className="task-actions">
          <button className="icon-button" onClick={onDelete} aria-label="Delete task">
            ✕
          </button>
        </div>
      </div>

      {task.editing ? (
        <div className="edit-block">
          <input
            className="edit-input"
            value={task.editedText}
            onChange={(event) => onEditChange(event.target.value)}
          />
          <button className="save-button" onClick={onSaveEdit}>
            Save
          </button>
        </div>
      ) : (
        <div className="task-content" onClick={onToggleEdit}>
          <span>{task.text}</span>
        </div>
      )}

      <div className="move-controls">
        <button onClick={() => onMove('previous')} disabled={columnKey === 'todo'}>
          ←
        </button>
        <button onClick={() => onMove('next')} disabled={columnKey === 'done'}>
          →
        </button>
      </div>
    </article>
  );
}

export default App;
