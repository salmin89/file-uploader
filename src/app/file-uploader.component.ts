import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import {
  combineLatest,
  fromEvent,
  Observable,
  Observer,
  of,
  BehaviorSubject,
  Subject,
} from 'rxjs';
import {
  catchError,
  filter,
  map,
  switchMap,
  takeUntil,
  shareReplay,
  tap,
  startWith,
} from 'rxjs/operators';

export type IVerifiedFile = Omit<IUploadedFile, 'error'>;

export interface IUploadedFile {
  file?: File;
  image?: Partial<HTMLImageElement>;
  error?: IUploadError;
}

export interface IUploadError {
  name: string;
  errorMessage: string;
}

@Component({
  selector: 'it-file-uploader',
  templateUrl: './file-uploader.component.html',
})
export class FileUploaderComponent {
  @ViewChild('fileInput') fileInputRef: ElementRef<HTMLInputElement>;

  @Input() fileSizeLimit: number;
  @Input() multiple: boolean = true;
  @Input() accept: string;
  @Input() disabled: boolean = false;

  @Input() initialValues: IUploadedFile[];

  initialFilesChanges$ = new BehaviorSubject<IUploadedFile[]>([]);
  uploadedFiles$ = new BehaviorSubject<IUploadedFile[]>([]);
  removed$ = new BehaviorSubject<IUploadedFile[]>([]);

  @Output() onFileChanges = new EventEmitter<IVerifiedFile[]>();

  files$: Observable<IUploadedFile[]> = combineLatest([
    this.initialFilesChanges$,
    this.uploadedFiles$,
    this.removed$,
  ]).pipe(
    map(([initialFiles, uploadedFiles, removedFiles]) => {
      const filesource =
        uploadedFiles.length === 0 ? initialFiles : uploadedFiles;

      return filesource.filter((file) => !removedFiles.find((r) => r === file));
    }),
    shareReplay()
  );

  unsubscribe = new Subject<void>();
  ngOnDestroy(): void {
    this.unsubscribe.next();
    this.unsubscribe.complete();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.initialValues) {
      this.initialFilesChanges$.next(changes.initialValues.currentValue);
    }
  }

  ngAfterViewInit() {
    fromEvent(this.fileInputRef.nativeElement, 'change')
      .pipe(
        takeUntil(this.unsubscribe),
        map((event) => (<HTMLInputElement>event.target).files),
        switchMap(this.validateFiles)
      )
      .subscribe((files: IUploadedFile[]) => this.uploadedFiles$.next(files));

    this.files$
      .pipe(
        takeUntil(this.unsubscribe),
        map((uploadedFiles: IUploadedFile[]) =>
          uploadedFiles.filter((files) => !files.error)
        )
      )
      .subscribe((result) => {
        this.onFileChanges.emit(result);
      });
  }

  private validateFiles = (files: FileList): Observable<IUploadedFile[]> => {
    const validatedFiles: Observable<IUploadedFile>[] = [];

    for (const file of Object.values(files)) {
      validatedFiles.push(
        this.validateFile(file).pipe(
          catchError((error: IUploadedFile) => of(error))
        )
      );
    }
    return combineLatest(validatedFiles);
  };

  private validateFile(file: File): Observable<IUploadedFile> {
    const fileReader = new FileReader();

    return new Observable((observer: Observer<IUploadedFile>) => {
      this.fileSizeLimit && this.validateSize(file, observer);

      fileReader.readAsDataURL(file);
      fileReader.onload = () => {
        this.validateFileType(file, fileReader, observer);
      };
      fileReader.onerror = () => {
        observer.error({
          error: {
            name: file.name,
            errorMessage: 'INVALID_FILE',
          },
        });
      };
    });
  }

  private isImage(mimeType: string): boolean {
    return mimeType.match(/image\/*/) !== null;
  }

  private validateFileType(
    file: File,
    fileReader: FileReader,
    observer: Observer<IUploadedFile>
  ): void {
    const { type, name } = file;
    if (this.isImage(type)) {
      const image = new Image();
      image.onload = () => {
        observer.next({ file, image });
        observer.complete();
      };
      image.onerror = () => {
        // image.onerror only triggers if the image is corrupt and won't load
        observer.error({ error: { name, errorMessage: 'INVALID_IMAGE' } });
      };
      image.src = fileReader.result as string;
    } else {
      // it's not an image
      observer.error({ error: { name, errorMessage: 'INVALID_IMAGE' } });
      observer.complete();
    }
  }

  private validateSize(file: File, observer: Observer<IUploadedFile>): void {
    const { name, size } = file;
    if (size > this.fileSizeLimit)
      observer.error({ error: { name, errorMessage: 'INVALID_SIZE' } });
  }

  public remove(file: IUploadedFile) {
    this.removed$.next([...this.removed$.value, file]);
  }

  public removeInitial(file) {
    this.initialValues = this.initialValues.filter((f) => file !== f);
    this.onFileChanges.emit(this.initialValues);
  }
}