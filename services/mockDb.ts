import { Project, User, ProjectTypeDef } from '../types';

// Updated Data provided by user
const RAW_DATA = {
  "成都": [
    { "name": "成都文殊坊", "type": "Commercial", "lat": 30.673223937624414, "lng": 104.07334685325624 },
    { "name": "成都太古里 & 博舍", "type": "Commercial", "lat": 30.6555, "lng": 104.0825 },
    { "name": "成都宽窄巷子", "type": "Commercial", "lat": 30.6635, "lng": 104.0535 },
    { "name": "成都锦里古街", "type": "Commercial", "lat": 30.6455, "lng": 104.0495 },
    { "name": "成都万科天荟+东郊记忆", "type": "Commercial", "lat": 30.6688, "lng": 104.1225 },
    { "name": "成都铁像寺水街 (一二期)", "type": "Commercial", "lat": 30.558, "lng": 104.049 },
    { "name": "绿城凤起朝鸣 (金沙)", "type": "Residential", "lat": 30.69190837013676, "lng": 104.00379717350008 },
    { "name": "德商锦江天玺 (三圣乡)", "type": "Residential", "lat": 30.587441438465227, "lng": 104.14896368980409 },
    { "name": "新希望锦麟府 (三圣乡)", "type": "Residential", "lat": 30.56263048401063, "lng": 104.17450904846191 },
    { "name": "锦江大院 (三圣乡)", "type": "Residential", "lat": 30.585109331280396, "lng": 104.14258539676666 },
    { "name": "首开金地鹭鸣北湖 (成华)", "type": "Residential", "lat": 30.72168526283625, "lng": 104.15735363960268 },
    { "name": "麓府大院 (天府新区)", "type": "Residential", "lat": 30.47669458094192, "lng": 104.10810291767122 },
    { "name": "多利桃花源 (郫都红光)", "type": "Residential", "lat": 30.84627378383382, "lng": 103.92373323440553 },
    { "name": "桃李春风 (都江堰柳街)", "type": "Residential", "lat": 30.79433620249537, "lng": 103.69358897209167 },
    { "name": "成都禅驿·嘉定院子 (乐山大佛)", "type": "Commercial", "lat": 30.674174393553837, "lng": 104.07418370246889, "details": "" }
  ],
  "杭州": [
    { "name": "杭州绿城吉祥里文化创意街区(祥符老街)", "type": "Commercial", "lat": 30.325471259328104, "lng": 120.10489940643312 },
    { "name": "杭州小河直街历史文化街区", "type": "Commercial", "lat": 30.308392815068764, "lng": 120.13511180877687 },
    { "name": "杭州大兜路历史文化街区", "type": "Commercial", "lat": 30.300334164245264, "lng": 120.14454245567323 },
    { "name": "杭州中国丝绸城步行街", "type": "Commercial", "lat": 30.264891399117758, "lng": 120.17355322837831 },
    { "name": "杭州清河坊历史街区", "type": "Commercial", "lat": 30.239687798138938, "lng": 120.16970694065095 },
    { "name": "杭州玉鸟集 (良渚)", "type": "Commercial", "lat": 30.36534949653873, "lng": 120.0288212299347 },
    { "name": "杭州金茂览秀城秦望水街(富阳)", "type": "Commercial", "lat": 30.04019028028254, "lng": 119.94097888469697, "details": "项目定位： 滨水TOD商业街区..." },
    { "name": "杭州木守西溪", "type": "Hotel", "lat": 30.255434435158108, "lng": 120.05271434783937 },
    { "name": "杭州湘湖逍遥庄园", "type": "Hotel", "lat": 30.15790192393773, "lng": 120.22798597812654 },
    { "name": "杭州1977民宿 (建德)", "type": "Hotel", "lat": 30.331416526614206, "lng": 119.87871408462526 },
    { "name": "杭州江南里", "type": "Residential", "lat": 30.32035915218401, "lng": 120.13751506805421 },
    { "name": "融创杭州湾壹号", "type": "Residential", "lat": 30.339310579927037, "lng": 121.19958937168121 },
    { "name": "杭州蓝绿双城湖印宸山", "type": "Residential", "lat": 30.391793309913968, "lng": 120.23973941802979 },
    { "name": "杭州保亿湖风雅园", "type": "Residential", "lat": 30.10925258586001, "lng": 120.20737051963808 },
    { "name": "杭州未来科技城世茂国风大境", "type": "Residential", "lat": 30.260512859246354, "lng": 119.76543903350831 },
    { "name": "杭州-玺园·长流", "type": "Residential", "lat": 30.234218981937012, "lng": 120.06023526191713 },
    { "name": "杭州-中天·璟樾青岚府", "type": "Residential", "lat": 30.269218780008963, "lng": 119.8148024082184 },
    { "name": "杭州绿城桃李春风", "type": "Residential", "lat": 30.27630248539919, "lng": 119.79595184326173 },
    { "name": "杭房·首望澜翠府", "type": "Residential", "lat": 30.082909033487105, "lng": 120.0268203020096 }
  ],
  "上海": [
    { "name": "上海张园", "type": "Commercial", "lat": 31.22803668131991, "lng": 121.45991921424867 },
    { "name": "上海EKA·天物", "type": "Commercial", "lat": 31.263273343728045, "lng": 121.57655239105226 },
    { "name": "上海-蟠龙天地", "type": "Commercial", "lat": 31.188555832346943, "lng": 121.27521693706514 },
    { "name": "上海-万科龙华会", "type": "Commercial", "lat": 31.173777820668594, "lng": 121.45334780216218 },
    { "name": "上生·新所", "type": "Commercial", "lat": 31.209241172801743, "lng": 121.42691731452943 },
    { "name": "上海鸿寿坊", "type": "Commercial", "lat": 31.241145906870504, "lng": 121.44015669822694 },
    { "name": "上海西岸梦中心", "type": "Commercial", "lat": 31.161370771194584, "lng": 121.4655250310898 },
    { "name": "嘉北五个院子", "type": "Hotel", "lat": 31.473080876589105, "lng": 121.22822999954225 }
  ],
  "苏州": [
    { "name": "苏州仁恒仓街", "type": "Commercial", "lat": 31.31131672377005, "lng": 120.63914179801942 },
    { "name": "苏州李公堤文创街区", "type": "Commercial", "lat": 31.299871968464178, "lng": 120.69697022438051 },
    { "name": "苏州昆山大渔湾湖滨风情商业街区", "type": "Commercial", "lat": 31.411395557926973, "lng": 120.89689671993257 },
    { "name": "苏州有熊酒店", "type": "Hotel", "lat": 31.30315382661027, "lng": 120.61450839042665 },
    { "name": "苏州湾绿城·桃源里", "type": "Residential", "lat": 31.160893367978005, "lng": 120.62025904655458 }
  ],
  "常州": [
    { "name": "常青里文化街区", "type": "Commercial", "lat": 31.748377791515768, "lng": 120.05111038684845 },
    { "name": "青果巷历史文化街区", "type": "Commercial", "lat": 31.77272507582928, "lng": 119.95959877967836 }
  ],
  "大同": [
    { "name": "东南邑·和阳里", "type": "Commercial", "lat": 40.090191469546426, "lng": 113.31082642078401 },
    { "name": "大同古城户部角", "type": "Commercial", "lat": 40.095292487762194, "lng": 113.29316139221193 },
    { "name": "既下山 (大同)", "type": "Hotel", "lat": 40.09198487190264, "lng": 113.31166326999666 },
    { "name": "江鸿铂蓝五龙巷", "type": "Residential", "lat": 40.100257713476324, "lng": 113.30048918724061 },
    { "name": "凤台晓月壹号院", "type": "Residential", "lat": 40.100951174843914, "lng": 113.29790890216829 }
  ],
  "宁波": [
    { "name": "宁波湾君澜理酒店", "type": "Hotel", "lat": 30.35285168138272, "lng": 121.2106239795685 },
    { "name": "宁波 桃李春风", "type": "Residential", "lat": 30.02765576421058, "lng": 121.37881994247438 }
  ],
  "安吉": [
    { "name": "绿城·安吉桃花源", "type": "Residential", "lat": 30.57626528636022, "lng": 119.63843643665315 },
    { "name": "安吉悦榕庄", "type": "Hotel", "lat": 30.57639460457767, "lng": 119.6255350112915 }
  ],
  "阜阳": [
    { "name": "阜阳罍街", "type": "Commercial", "lat": 32.80597017558381, "lng": 115.9144413471222 }
  ],
  "郑州": [
    { "name": "郑州-亳都新巷", "type": "Commercial", "lat": 34.748934037139755, "lng": 113.68903934955597 }
  ],
  "济南": [
    { "name": "济南蓝城桃李春风", "type": "Residential", "lat": 36.52920874329399, "lng": 116.99476003646852 }
  ]
};

// Flatten raw data
const INITIAL_PROJECTS: Project[] = [];
let idCounter = 1;
Object.entries(RAW_DATA).forEach(([city, list]) => {
    // @ts-ignore
    list.forEach(p => {
        INITIAL_PROJECTS.push({
            id: `p${idCounter++}`,
            city: city,
            name: p.name,
            type: p.type, // keeping string
            label: '大名考察',
            lat: p.lat,
            lng: p.lng,
            isHidden: false,
            // @ts-ignore
            publicDescription: p.details || '',
            images: [],
            internalImages: [],
            attachments: [],
            internalDescription: '',
            customSections: [],
            createdBy: 'admin',
            createdByName: '主管理员'
        });
    });
});

const INITIAL_USERS: User[] = [
    { id: 'admin', username: 'admin', password: '123', role: 'admin', name: '主管理员' },
    { id: 'user1', username: 'editor1', password: '123', role: 'editor', name: '分账号A' },
];

const INITIAL_TYPES: ProjectTypeDef[] = [
    { key: 'Commercial', label: '商业街', color: '#e74c3c', bgColorClass: 'bg-red-100 text-red-800 border-red-200' },
    { key: 'Residential', label: '居住', color: '#3498db', bgColorClass: 'bg-blue-100 text-blue-800 border-blue-200' },
    { key: 'Mixed', label: '商住', color: '#9b59b6', bgColorClass: 'bg-purple-100 text-purple-800 border-purple-200' },
    { key: 'Hotel', label: '酒店', color: '#f1c40f', bgColorClass: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    { key: 'Office', label: '办公', color: '#2ecc71', bgColorClass: 'bg-green-100 text-green-800 border-green-200' },
    { key: 'CommercialMALL', label: '商业MALL', color: '#ff7f50', bgColorClass: 'bg-orange-100 text-orange-800 border-orange-200' },
];

const KEYS = {
    PROJECTS: 'tztw_projects_v71',
    USERS: 'tztw_users_v71',
    TYPES: 'tztw_types_v71',
    CURRENT_USER: 'tztw_current_user_v71',
    LABEL_NAME: 'tztw_label_name_v71'
};

class MockDatabase {
    constructor() {
        if (!localStorage.getItem(KEYS.PROJECTS)) {
            localStorage.setItem(KEYS.PROJECTS, JSON.stringify(INITIAL_PROJECTS));
        }
        if (!localStorage.getItem(KEYS.USERS)) {
            localStorage.setItem(KEYS.USERS, JSON.stringify(INITIAL_USERS));
        }
        if (!localStorage.getItem(KEYS.TYPES)) {
            localStorage.setItem(KEYS.TYPES, JSON.stringify(INITIAL_TYPES));
        }
        if (!localStorage.getItem(KEYS.LABEL_NAME)) {
            localStorage.setItem(KEYS.LABEL_NAME, '项目属性');
        }
    }

    // --- User / Auth ---

    login(username: string, password: string): Promise<User> {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                const users = JSON.parse(localStorage.getItem(KEYS.USERS) || '[]');
                const user = users.find((u: User) => u.username === username && u.password === password);
                if (user) {
                    const safeUser = { ...user };
                    localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(safeUser));
                    resolve(safeUser);
                } else {
                    reject(new Error('Invalid credentials'));
                }
            }, 300);
        });
    }

    logout(): Promise<void> {
        return new Promise((resolve) => {
            localStorage.removeItem(KEYS.CURRENT_USER);
            resolve();
        });
    }

    getCurrentUser(): User | null {
        const u = localStorage.getItem(KEYS.CURRENT_USER);
        return u ? JSON.parse(u) : null;
    }

    getUsers(): User[] {
        return JSON.parse(localStorage.getItem(KEYS.USERS) || '[]');
    }

    addUser(user: User): Promise<void> {
        return new Promise((resolve) => {
            const users = this.getUsers();
            users.push(user);
            localStorage.setItem(KEYS.USERS, JSON.stringify(users));
            resolve();
        });
    }

    // --- Types ---
    getProjectTypes(): Promise<ProjectTypeDef[]> {
        return new Promise((resolve) => {
            const types = JSON.parse(localStorage.getItem(KEYS.TYPES) || '[]');
            resolve(types);
        });
    }

    addProjectType(typeDef: ProjectTypeDef): Promise<void> {
        return new Promise((resolve) => {
            const types = JSON.parse(localStorage.getItem(KEYS.TYPES) || '[]');
            types.push(typeDef);
            localStorage.setItem(KEYS.TYPES, JSON.stringify(types));
            resolve();
        });
    }

    // --- Projects ---

    getProjects(): Promise<Project[]> {
        return new Promise((resolve) => {
            setTimeout(() => {
                const projects = JSON.parse(localStorage.getItem(KEYS.PROJECTS) || '[]');
                resolve(projects);
            }, 200);
        });
    }

    saveProject(project: Project): Promise<void> {
        return new Promise((resolve) => {
            const projects = JSON.parse(localStorage.getItem(KEYS.PROJECTS) || '[]');
            const index = projects.findIndex((p: Project) => p.id === project.id);
            if (index >= 0) {
                projects[index] = project;
            } else {
                projects.push(project);
            }
            localStorage.setItem(KEYS.PROJECTS, JSON.stringify(projects));
            resolve();
        });
    }
    
    saveProjectsList(projects: Project[]): Promise<void> {
        return new Promise((resolve) => {
            localStorage.setItem(KEYS.PROJECTS, JSON.stringify(projects));
            resolve();
        });
    }

    deleteProject(projectId: string): Promise<void> {
        return new Promise((resolve) => {
            let projects = JSON.parse(localStorage.getItem(KEYS.PROJECTS) || '[]');
            projects = projects.filter((p: Project) => p.id !== projectId);
            localStorage.setItem(KEYS.PROJECTS, JSON.stringify(projects));
            resolve();
        });
    }
    
    deleteProjectsByCity(city: string): Promise<void> {
        return new Promise((resolve) => {
            let projects = JSON.parse(localStorage.getItem(KEYS.PROJECTS) || '[]');
            projects = projects.filter((p: Project) => p.city !== city);
            localStorage.setItem(KEYS.PROJECTS, JSON.stringify(projects));
            resolve();
        });
    }
    
    renameProjectLabel(oldLabel: string, newLabel: string): Promise<void> {
        return new Promise((resolve) => {
            let projects = JSON.parse(localStorage.getItem(KEYS.PROJECTS) || '[]');
            let changed = false;
            projects = projects.map((p: Project) => {
                if (p.label === oldLabel) {
                    changed = true;
                    return { ...p, label: newLabel };
                }
                return p;
            });
            if (changed) {
                localStorage.setItem(KEYS.PROJECTS, JSON.stringify(projects));
            }
            resolve();
        });
    }
    
    clearAllProjects(): Promise<void> {
        return new Promise((resolve) => {
            localStorage.setItem(KEYS.PROJECTS, JSON.stringify([]));
            resolve();
        });
    }

    // --- Global Settings ---
    getLabelFieldName(): string {
        return localStorage.getItem(KEYS.LABEL_NAME) || '项目属性';
    }

    setLabelFieldName(name: string): void {
        localStorage.setItem(KEYS.LABEL_NAME, name);
    }
}

export const db = new MockDatabase();
