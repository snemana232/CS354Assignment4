import { Camera } from "../lib/webglutils/Camera.js";
import { CanvasAnimation } from "../lib/webglutils/CanvasAnimation.js";
import { SkinningAnimation } from "./App.js";
import { Mat4, Vec3, Vec4, Vec2, Mat2, Quat } from "../lib/TSM.js";
import { Bone } from "./Scene.js";
import { RenderPass } from "../lib/webglutils/RenderPass.js";



 
/**
 * 
 * Might be useful for designing any animation GUI
 */
interface IGUI {
  viewMatrix(): Mat4;
  projMatrix(): Mat4;
  dragStart(me: MouseEvent): void;
  drag(me: MouseEvent): void;
  dragEnd(me: MouseEvent): void;
  onKeydown(ke: KeyboardEvent): void;
}

export enum Mode {
  playback,  
  edit  
}

/**
 * Handles Mouse and Button events along with
 * the the camera.
 */

export class GUI implements IGUI {
  private static readonly rotationSpeed: number = 0.05;
  private static readonly zoomSpeed: number = 0.1;
  private static readonly rollSpeed: number = 0.1;
  private static readonly panSpeed: number = 0.1;

  private camera: Camera;
  private dragging: boolean;
  private fps: boolean;
  private prevX: number;
  private prevY: number;

  private height: number;
  private viewPortHeight: number;
  private width: number;

  private animation: SkinningAnimation;

  public highlight: number;


  public time: number;
  
  public mode: Mode;
  

  

  public hoverX: number = 0;
  public hoverY: number = 0;


  /**
   *
   * @param canvas required to get the width and height of the canvas
   * @param animation required as a back pointer for some of the controls
   * @param sponge required for some of the controls
   */
  constructor(canvas: HTMLCanvasElement, animation: SkinningAnimation) {
    this.height = canvas.height;
    this.viewPortHeight = this.height - 200;
    this.width = canvas.width;
    this.prevX = 0;
    this.prevY = 0;
    
    this.animation = animation;
    
    this.reset();
    
    this.registerEventListeners(canvas);
  }

  public getNumKeyFrames(): number {
    // TODO
    // Used in the status bar in the GUI
    return 0;
  }
  public getTime(): number { return this.time; }
  
  public getMaxTime(): number { 
    // TODO
    // The animation should stop after the last keyframe
    return 0;
  }

  /**
   * Resets the state of the GUI
   */
  public reset(): void {
    this.fps = false;
    this.dragging = false;
    this.time = 0;
    this.mode = Mode.edit;
    this.camera = new Camera(
      new Vec3([0, 0, -6]),
      new Vec3([0, 0, 0]),
      new Vec3([0, 1, 0]),
      45,
      this.width / this.viewPortHeight,
      0.1,
      1000.0
    );
  }

  /**
   * Sets the GUI's camera to the given camera
   * @param cam a new camera
   */
  public setCamera(
    pos: Vec3,
    target: Vec3,
    upDir: Vec3,
    fov: number,
    aspect: number,
    zNear: number,
    zFar: number
  ) {
    this.camera = new Camera(pos, target, upDir, fov, aspect, zNear, zFar);
  }

  /**
   * Returns the view matrix of the camera
   */
  public viewMatrix(): Mat4 {
    return this.camera.viewMatrix();
  }

  /**
   * Returns the projection matrix of the camera
   */
  public projMatrix(): Mat4 {
    return this.camera.projMatrix();
  }

  /**
   * Callback function for the start of a drag event.
   * @param mouse
   */
  public dragStart(mouse: MouseEvent): void {
    if (mouse.offsetY > 600) {
      // outside the main panel
      return;
    }
    
    // TODO
    // Some logic to rotate the bones, instead of moving the camera, if there is a currently highlighted bone
    
    this.dragging = true;
    this.prevX = mouse.screenX;
    this.prevY = mouse.screenY;
    
  }

  public incrementTime(dT: number): void {
    if (this.mode === Mode.playback) {
      this.time += dT;
      if (this.time >= this.getMaxTime()) {
        this.time = 0;
        this.mode = Mode.edit;
      }
    }
  }

  /**
  
   * The callback function for a drag event.
   * This event happens after dragStart and
   * before dragEnd.
   * @param mouse
   */
  public drag(mouse: MouseEvent): void {
    let x = mouse.offsetX;
    let y = mouse.offsetY;
    if (this.dragging) {
      const dx = mouse.screenX - this.prevX;
      const dy = mouse.screenY - this.prevY;
      this.prevX = mouse.screenX;
      this.prevY = mouse.screenY;

      /* Left button, or primary button */
      const mouseDir: Vec3 = this.camera.right();
      mouseDir.scale(-dx);
      mouseDir.add(this.camera.up().scale(dy));
      mouseDir.normalize();

      if (dx === 0 && dy === 0) {
        return;
      }

      switch (mouse.buttons) {
        case 1: {
          let rotAxis: Vec3 = Vec3.cross(this.camera.forward(), mouseDir);
          rotAxis = rotAxis.normalize();

          if (this.fps) {
            this.camera.rotate(rotAxis, GUI.rotationSpeed);
          } else {
            this.camera.orbitTarget(rotAxis, GUI.rotationSpeed);
          }
          break;
        }
        case 2: {
          /* Right button, or secondary button */
          this.camera.offsetDist(Math.sign(mouseDir.y) * GUI.zoomSpeed);
          break;
        }
        default: {
          break;
        }
      }
    } 
    
    // TODO
    // You will want logic here:
    // 1) To highlight a bone, if the mouse is hovering over a bone;
    // 2) To rotate a bone, if the mouse button is pressed and currently highlighting a bone.
    let camera_coords: Vec3 = new Vec3(this.screenToWorld(mouse.screenX, mouse.screenY).xyz);
    //let world_ray: Vec3 =  new Vec3(this.camera.viewMatrix().inverse().multiplyVec4(camera_coords).xyz).normalize();
    //I have the ray in world space
    console.log("point in world space:[" + camera_coords.x + ", " + camera_coords.y + ", " + camera_coords.z + "]");

    let p: Vec3 = this.camera.pos();
    console.log("camera position: [" + this.camera.pos().x + ", " + this.camera.pos().y + ", " + this.camera.pos().z + "]");

    const j_vec: Vec3 = new Vec3([0, 1, 0]);
    // Transform the ray into the cylinder's coordinates. Use the bone's orientation to do this.
    let ind: Bone[] = this.animation.getScene().meshes[0].bones;
          //Instead of projecting the bone onto the y axis the magnitude of the bone vector is used to generate the maximum
          //y value for the transformed bone.
    console.log("number of bones " + ind.length);

    for (let i = 0; i < ind.length; i++) {

      let bone = ind[i];

      const z_max: number = bone.endpoint.subtract(bone.position).length();

      p = p.subtract(bone.position);
      let q: Vec3 = camera_coords.subtract(bone.position);
      const tang: Vec3 = (bone.endpoint.subtract(bone.position));
      let cross_product: Vec3 = Vec3.cross(j_vec, tang);
      let rot: Quat = new Quat([cross_product.x, cross_product.y, cross_product.z, Math.sqrt(Math.pow(j_vec.length(), 2) * Math.pow(tang.length(), 2)) + Vec3.dot(j_vec, tang)]);
      rot.normalize();          
            
      let Rotation: Mat4 = rot.toMat4();

      let p_Cyl: Vec3 = Rotation.inverse().multiplyVec3(p);
      let q_Cyl: Vec3 = Rotation.inverse().multiplyVec3(q);


      let d: Vec3 = q_Cyl.subtract(p_Cyl).normalize();


      let a: number = Math.pow(d.x, 2) + Math.pow(d.y, 2);
      let b: number = 2*p_Cyl.x*d.x + 2*p_Cyl.y*d.y;
      let c: number = Math.pow(p.x, 2) + Math.pow(p.y, 2) - 1;
      
      //Solve for t;
      //let t: number = -1*b + Math.sqrt()  
      let t1: number = (-1 * b + Math.sqrt(Math.pow(b, 2) - 4*a*c))/2
      let t2: number = (-1 * b - Math.sqrt(Math.pow(b, 2) - 4*a*c))/2
      

     let eval1: Vec3 = new Vec3([p_Cyl.x + d.x*t1, p_Cyl.y + d.y*t1, p_Cyl.z + d.z*t1 ]);
     let eval2: Vec3 = new Vec3([p_Cyl.x + d.x*t2, p_Cyl.y + d.y*t2, p_Cyl.z + d.z*t2 ]);
      
     if ((eval1.z>= 0 && eval1.z <= z_max) || (eval2.z >= 0 && eval2.z <= z_max)) {
        console.log("x: " + eval1.x + ",y: " + eval1.y, ",z: " + eval1.z);
        console.log("x: " + eval2.x + ",y: " + eval2.y, ",z: " + eval2.z);
        console.log("intersection");
        this.highlight = i;
     }
    }
  }

  public screenToWorld(mouseX: number, mouseY: number): Vec4 {
      let ndc_x : number = ((2.0 * mouseX) / this.width) - 1.0;
      let ndc_y: number = 1.0 - ( 2.0 * mouseY) / this.viewPortHeight;
      let ndc_z = -1.0;
      console.log("ndc_x: " + ndc_x + ", ndc_y: " + ndc_y);

      let ndc_coords: Vec4 = new Vec4([ndc_x, ndc_y, ndc_z, 1.0]);
      let camera_coords: Vec4 = this.camera.projMatrix().inverse().multiplyVec4(ndc_coords);
      camera_coords = new Vec4([camera_coords.x, camera_coords.y, -1.0, 1.0]);
      return camera_coords;
  }

  public getModeString(): string {
    switch (this.mode) {
      case Mode.edit: { return "edit: " + this.getNumKeyFrames() + " keyframes"; }
      case Mode.playback: { return "playback: " + this.getTime().toFixed(2) + " / " + this.getMaxTime().toFixed(2); }
    }
  }

  /**
   * Callback function for the end of a drag event
   * @param mouse
   */
  public dragEnd(mouse: MouseEvent): void {
    this.dragging = false;
    this.prevX = 0;
    this.prevY = 0;
    
    // TODO
    // Maybe your bone highlight/dragging logic needs to do stuff here too
  }

  /**
   * Callback function for a key press event
   * @param key
   */
  public onKeydown(key: KeyboardEvent): void {
    switch (key.code) {
      case "Digit1": {
        this.animation.setScene("/static/assets/skinning/split_cube.dae");
        break;
      }
      case "Digit2": {
        this.animation.setScene("/static/assets/skinning/long_cubes.dae");
        break;
      }
      case "Digit3": {
        this.animation.setScene("/static/assets/skinning/simple_art.dae");
        break;
      }      
      case "Digit4": {
        this.animation.setScene("/static/assets/skinning/mapped_cube.dae");
        break;
      }
      case "Digit5": {
        this.animation.setScene("/static/assets/skinning/robot.dae");
        break;
      }
      case "Digit6": {
        this.animation.setScene("/static/assets/skinning/head.dae");
        break;
      }
      case "Digit7": {
        this.animation.setScene("/static/assets/skinning/wolf.dae");
        break;
      }
      case "KeyW": {
        this.camera.offset(
            this.camera.forward().negate(),
            GUI.zoomSpeed,
            true
          );
        break;
      }
      case "KeyA": {
        this.camera.offset(this.camera.right().negate(), GUI.zoomSpeed, true);
        break;
      }
      case "KeyS": {
        this.camera.offset(this.camera.forward(), GUI.zoomSpeed, true);
        break;
      }
      case "KeyD": {
        this.camera.offset(this.camera.right(), GUI.zoomSpeed, true);
        break;
      }
      case "KeyR": {
        this.animation.reset();
        break;
      }
      case "ArrowLeft": {
        this.camera.roll(GUI.rollSpeed, false);
        break;
      }
      case "ArrowRight": {
        this.camera.roll(GUI.rollSpeed, true);
        break;
      }
      case "ArrowUp": {
        this.camera.offset(this.camera.up(), GUI.zoomSpeed, true);
        break;
      }
      case "ArrowDown": {
        this.camera.offset(this.camera.up().negate(), GUI.zoomSpeed, true);
        break;
      }
      case "KeyK": {
        if (this.mode === Mode.edit) {
            // TODO
            // Add keyframe
        }
        break;
      }      
      case "KeyP": {
        if (this.mode === Mode.edit && this.getNumKeyFrames() > 1)
        {
          this.mode = Mode.playback;
          this.time = 0;
        } else if (this.mode === Mode.playback) {
          this.mode = Mode.edit;
        }
        break;
      }
      default: {
        console.log("Key : '", key.code, "' was pressed.");
        break;
      }
    }
  }

  /**
   * Registers all event listeners for the GUI
   * @param canvas The canvas being used
   */
  private registerEventListeners(canvas: HTMLCanvasElement): void {
    /* Event listener for key controls */
    window.addEventListener("keydown", (key: KeyboardEvent) =>
      this.onKeydown(key)
    );

    /* Event listener for mouse controls */
    canvas.addEventListener("mousedown", (mouse: MouseEvent) =>
      this.dragStart(mouse)
    );

    canvas.addEventListener("mousemove", (mouse: MouseEvent) =>
      this.drag(mouse)
    );

    canvas.addEventListener("mouseup", (mouse: MouseEvent) =>
      this.dragEnd(mouse)
    );

    /* Event listener to stop the right click menu */
    canvas.addEventListener("contextmenu", (event: any) =>
      event.preventDefault()
    );
  }
}
