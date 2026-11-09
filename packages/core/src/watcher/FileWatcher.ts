import chokidar, { FSWatcher } from 'chokidar';
import path from 'node:path';
import type { CallGraphBuilder } from '../analyzer/CallGraphBuilder.js';
import type { ProjectGraphData } from '../types/index.js';

export interface WatcherOptions {
  ignored?: (string | RegExp)[];
  debounceMs?: number;
}

export type GraphUpdateCallback = (data: ProjectGraphData, event: 'add' | 'change' | 'unlink', filePath: string) => void;

export class FileWatcher {
  private watcher: FSWatcher | null = null;
  private builder: CallGraphBuilder;
  private projectRoot: string;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private callbacks: Set<GraphUpdateCallback> = new Set();

  constructor(builder: CallGraphBuilder, projectRoot: string) {
    this.builder = builder;
    this.projectRoot = path.resolve(projectRoot);
  }

  public onUpdate(callback: GraphUpdateCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  public start(options: WatcherOptions = {}): void {
    const debounceMs = options.debounceMs ?? 150;
    const defaultIgnored = [
      /(^|[/\\])\../, // dotfiles
      /node_modules/,
      /dist/,
      /\.git/
    ];

    const watchPatterns = [
      path.join(this.projectRoot, '**/*.ts'),
      path.join(this.projectRoot, '**/*.tsx'),
      path.join(this.projectRoot, '**/*.js'),
      path.join(this.projectRoot, '**/*.jsx')
    ];

    this.watcher = chokidar.watch(watchPatterns, {
      ignored: options.ignored ? [...defaultIgnored, ...options.ignored] : defaultIgnored,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50
      }
    });

    const triggerUpdate = (event: 'add' | 'change' | 'unlink', filePath: string) => {
      let graphData: ProjectGraphData;
      if (event === 'unlink') {
        graphData = this.builder.removeFile(filePath);
      } else {
        graphData = this.builder.updateFile(filePath);
      }

      for (const cb of this.callbacks) {
        cb(graphData, event, filePath);
      }
    };

    const handleEvent = (event: 'add' | 'change' | 'unlink', rawPath: string) => {
      const normalized = path.resolve(rawPath).replace(/\\/g, '/');
      const existing = this.debounceTimers.get(normalized);
      if (existing) {
        clearTimeout(existing);
      }

      const timer = setTimeout(() => {
        this.debounceTimers.delete(normalized);
        triggerUpdate(event, normalized);
      }, debounceMs);

      this.debounceTimers.set(normalized, timer);
    };

    this.watcher
      .on('add', (p) => handleEvent('add', p))
      .on('change', (p) => handleEvent('change', p))
      .on('unlink', (p) => handleEvent('unlink', p));
  }

  public async stop(): Promise<void> {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }
}

